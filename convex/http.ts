import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { handle, PROTOCOL, TOOLS } from './mcp'
import { CONSOLIDATING } from './lib/industries'
import { DEFAULTS, SUPPORTED } from './lib/criteria'

/**
 * One deployment serves both surfaces.
 *
 * The REST API and the MCP server are the same engine behind two doors, which is the point: an
 * integration team wires the first, an agent uses the second, and neither is a different product
 * with a different answer.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, accept, mcp-protocol-version, mcp-session-id, last-event-id',
  // Without this a browser-based client cannot read the session id it is supposed to echo back.
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
  'access-control-max-age': '86400',
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  })

const preflight = httpAction(async () => new Response(null, { status: 204, headers: CORS }))

/**
 * Bearer auth, with one deliberate hole: while no key has been minted the API is open, so a fresh
 * deployment can be tried without a round trip. `GET /v1/health` says which mode it is in, because
 * a security posture nobody can see is not one.
 */
async function authed(ctx: Parameters<Parameters<typeof httpAction>[0]>[0], req: Request): Promise<string | null> {
  const minted = await ctx.runQuery(internal.keys.count, {})
  if (!minted) return 'open'
  const header = req.headers.get('authorization') ?? ''
  const secret = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!secret) return null
  const row = await ctx.runQuery(internal.keys.check, { secret })
  if (!row) return null
  await ctx.runMutation(internal.keys.touch, { secret })
  return row.label
}

const http = httpRouter()

/* ------------------------------------------------------------------ REST */

http.route({
  path: '/v1/health',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const minted = await ctx.runQuery(internal.keys.count, {})
    return json({
      ok: true,
      service: 'originaatio',
      auth: minted ? 'bearer key required' : 'open until a key is minted',
      countries: SUPPORTED,
      industries: Object.keys(CONSOLIDATING).length,
      defaults: DEFAULTS,
      endpoints: ['POST /v1/runs', 'GET /v1/runs', 'GET /v1/runs/{id}', 'GET /v1/runs/{id}/targets', 'POST /mcp'],
    })
  }),
})

http.route({
  path: '/v1/runs',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    if (!(await authed(ctx, req))) return json({ error: 'unauthorized' }, 401)
    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      /* an empty body means "use the defaults", which is a legitimate request */
    }
    try {
      const runId = await ctx.runMutation(internal.runs.startInternal, { criteria: body, source: 'api' })
      const run = await ctx.runQuery(internal.runs.getInternal, { runId })
      return json({ run_id: runId, status: 'queued', criteria: run?.criteria, poll: `/v1/runs/${runId}` }, 202)
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 400)
    }
  }),
})

http.route({ path: '/v1/runs', method: 'OPTIONS', handler: preflight })

http.route({
  path: '/v1/runs',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    if (!(await authed(ctx, req))) return json({ error: 'unauthorized' }, 401)
    const runs = await ctx.runQuery(internal.runs.listInternal, { limit: 20 })
    return json(
      runs.map((r) => ({
        run_id: r._id,
        status: r.status,
        source: r.source,
        countries: r.criteria.countries,
        targets: r.targetCount,
        started_at: new Date(r.startedAt).toISOString(),
      })),
    )
  }),
})

/**
 * Path parameters, by hand.
 *
 * Convex routes on an exact path or a prefix, so `/v1/runs/{id}` and `/v1/runs/{id}/targets` share
 * one prefix handler that reads the tail itself. Less magic than a router, and the two shapes are
 * visible in one place.
 */
http.route({
  pathPrefix: '/v1/runs/',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    if (!(await authed(ctx, req))) return json({ error: 'unauthorized' }, 401)
    const url = new URL(req.url)
    const tail = url.pathname.slice('/v1/runs/'.length).split('/')
    const runId = tail[0] as Id<'runs'>
    const wantsTargets = tail[1] === 'targets'

    const run = await ctx.runQuery(internal.runs.getInternal, { runId }).catch(() => null)
    if (!run) return json({ error: 'no such run' }, 404)

    if (!wantsTargets) {
      return json({
        run_id: runId,
        status: run.status,
        error: run.error,
        source: run.source,
        criteria: run.criteria,
        stages: run.stages,
        lanes: run.lanes.map((l) => ({
          country: l.country,
          register: l.v[0],
          after_filter: l.v[1],
          filed_in_window: l.v[2],
          passed_size: l.v[3],
          with_buyer: l.buyers,
          state: l.state,
          ms: l.ms,
          note: l.note,
        })),
        targets: run.targetCount,
        started_at: new Date(run.startedAt).toISOString(),
        finished_at: run.finishedAt ? new Date(run.finishedAt).toISOString() : null,
      })
    }

    const limit = Number(url.searchParams.get('limit') ?? 100)
    const country = url.searchParams.get('country')
    let rows = await ctx.runQuery(internal.runs.targetsInternal, { runId, limit: 1000 })
    if (country) rows = rows.filter((r) => r.country === country.toUpperCase())
    return json({
      run_id: runId,
      count: Math.min(rows.length, limit),
      targets: rows.slice(0, limit).map((r) => ({
        business_id: r.businessId,
        name: r.name,
        country: r.country,
        industry: r.industry,
        industry_name: r.industryName,
        city: r.city,
        age: r.age,
        currency: r.currency,
        size: r.size,
        size_previous: r.sizePrev,
        change_pct: r.changePct,
        filed_at: r.filedAt,
        score: r.score,
        reason: r.reasons.map((x) => x.label),
        buyers: r.buyers.map((b) => b.name),
        analysis: r.analysis,
        status: r.status,
        verify: r.verifyUrl,
      })),
    })
  }),
})

http.route({ pathPrefix: '/v1/runs/', method: 'OPTIONS', handler: preflight })

/* ------------------------------------------------------------------- MCP */

http.route({
  path: '/mcp',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    if (!(await authed(ctx, req))) {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'unauthorized' } }, 401)
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, 400)
    }

    // A client may batch. Notifications get no reply, and a batch of only notifications gets 202.
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map((m) => handle(ctx, m)))).filter((x) => x !== null)
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS })
    }
    const msg = body as Record<string, unknown>
    const res = await handle(ctx, msg)
    if (res === null) return new Response(null, { status: 202, headers: CORS })

    /**
     * A session id on the initialize response, echoed by the client on every later request.
     *
     * This server keeps no per-session state, so the value is only an identifier; issuing one
     * anyway is what several clients look for before they consider the handshake complete.
     */
    const extra: Record<string, string> =
      msg.method === 'initialize'
        ? { 'mcp-session-id': crypto.randomUUID(), 'mcp-protocol-version': PROTOCOL }
        : {}
    return json(res, 200, extra)
  }),
})

/**
 * A client opening the server-to-client stream. There is nothing to stream: every reply here is
 * the direct answer to a request, so the spec's answer is 405 rather than a body the client cannot
 * parse. Returning JSON to an `Accept: text/event-stream` request is what leaves a client hanging.
 */
http.route({
  path: '/mcp',
  method: 'DELETE',
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
})

http.route({ path: '/mcp', method: 'OPTIONS', handler: preflight })

/**
 * A GET is either a client opening the notification stream or a human in a browser.
 *
 * The first gets 405, because this server never initiates anything and a JSON body in place of an
 * event stream is worse than a refusal. The second gets told what this endpoint is.
 */
http.route({
  path: '/mcp',
  method: 'GET',
  handler: httpAction(async (_ctx, req) => {
    if ((req.headers.get('accept') ?? '').includes('text/event-stream')) {
      return new Response('Method Not Allowed: this server does not open a notification stream.', {
        status: 405,
        headers: { ...CORS, allow: 'POST, DELETE, OPTIONS' },
      })
    }
    return json({
      name: 'originaatio',
      transport: 'streamable-http',
      usage: 'POST JSON-RPC 2.0 to this URL. Send initialize, then tools/list, then tools/call.',
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    })
  }),
})

export default http
