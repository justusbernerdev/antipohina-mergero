import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { CONSOLIDATING } from './lib/industries'
import { DEFAULTS, SUPPORTED, CURRENCY } from './lib/criteria'

/**
 * The MCP surface, over the same engine the REST API uses.
 *
 * Four tools, because an agent that has to learn seven will use three. The important design
 * decision is that `start_run` returns immediately: a real run takes minutes, and an agent blocked
 * on a tool call for four minutes is an agent that has timed out. It gets a run id and is told, in
 * the tool description, to poll `get_run`.
 *
 * Transport is Streamable HTTP — a plain JSON-RPC POST. No SSE, because nothing here streams.
 */

const PROTOCOL = '2025-06-18'

const industryList = Object.entries(CONSOLIDATING)
  .map(([code, name]) => `${code} ${name}`)
  .join(', ')

export const TOOLS = [
  {
    name: 'start_run',
    description:
      'Start an origination run against the public company registers of one or more countries. ' +
      'Returns a run id immediately; a run takes two to five minutes, so poll get_run until status is "done". ' +
      `Supported countries: ${SUPPORTED.join(', ')}. Omit any field to use the default for that country.`,
    inputSchema: {
      type: 'object',
      properties: {
        countries: { type: 'array', items: { type: 'string', enum: [...SUPPORTED] }, description: 'Default ["FI"].' },
        industries: {
          type: 'array',
          items: { type: 'string' },
          description: `Industry codes, or a prefix such as "43*". Defaults to every consolidating industry. Known codes: ${industryList}`,
        },
        minAgeYears: { type: 'number', description: 'Company age in years. Default 15.' },
        minSize: {
          type: 'object',
          description:
            'Minimum size per country in LOCAL currency. Finland reads a balance sheet total (EUR), Norway reads revenue (NOK). Default {"FI":1500000,"NO":15000000}.',
        },
        filingWindowDays: {
          type: 'number',
          description: 'How recently the financial statement was registered. This is the timing signal. Default 70.',
        },
        excludeHolding: { type: 'boolean', description: 'Drop holding and property vehicles by name. Default true.' },
        limit: { type: 'number', description: 'Maximum targets returned. Default 200.' },
      },
    },
  },
  {
    name: 'get_run',
    description:
      'Status of a run: which stage it is on, how many companies survived each stage, and per-country lane counts. ' +
      'Poll this after start_run until status is "done" or "error".',
    inputSchema: {
      type: 'object',
      properties: { run: { type: 'string', description: 'The run id from start_run.' } },
      required: ['run'],
    },
  },
  {
    name: 'get_targets',
    description:
      'The scored owners a finished run produced, highest score first, with the buyers whose criteria they meet. ' +
      'Use explain for the full analysis of one company. Nothing is ever sent: every row is awaiting_human.',
    inputSchema: {
      type: 'object',
      properties: {
        run: { type: 'string', description: 'The run id.' },
        country: { type: 'string', description: 'Optional filter, e.g. "NO".' },
        industry: { type: 'string', description: 'Optional industry code filter.' },
        limit: { type: 'number', description: 'Default 20.' },
      },
      required: ['run'],
    },
  },
  {
    name: 'explain',
    description:
      'The full analysis of one company: every figure with the basis it rests on, every scoring reason with its ' +
      'points, the matching buyers with the public evidence behind each, what public data cannot tell you here, ' +
      'and the questions still open. Facts only — writing to the owner is the advisor\'s job, not the engine\'s.',
    inputSchema: {
      type: 'object',
      properties: {
        run: { type: 'string', description: 'The run id.' },
        business_id: { type: 'string', description: 'Business ID (FI) or organisasjonsnummer (NO).' },
      },
      required: ['run', 'business_id'],
    },
  },
]

const money = (n: number, c: string) =>
  c === 'NOK' ? `${(n / 1e6).toFixed(1)} M NOK` : `${(n / 1e6).toFixed(2)} M EUR`

async function call(ctx: ActionCtx, name: string, args: Record<string, unknown>): Promise<string> {
  if (name === 'start_run') {
    const runId = await ctx.runMutation(internal.runs.startInternal, { criteria: args, source: 'mcp' })
    const run = await ctx.runQuery(internal.runs.getInternal, { runId })
    return JSON.stringify(
      {
        run: runId,
        status: 'queued',
        criteria: run?.criteria ?? DEFAULTS,
        next: 'Poll get_run with this run id. Expect two to five minutes.',
      },
      null,
      2,
    )
  }

  if (name === 'get_run') {
    const run = await ctx.runQuery(internal.runs.getInternal, { runId: args.run as Id<'runs'> })
    if (!run) return JSON.stringify({ error: 'no such run' })
    return JSON.stringify(
      {
        run: args.run,
        status: run.status,
        error: run.error,
        stages: run.stages.map((s) => ({ stage: s.key, in: s.in, out: s.out, state: s.state })),
        lanes: run.lanes.map((l) => ({
          country: l.country,
          register: l.v[0],
          after_filter: l.v[1],
          filed_in_window: l.v[2],
          passed_size: l.v[3],
          with_buyer: l.buyers,
          state: l.state,
          note: l.note,
        })),
        targets: run.targetCount,
      },
      null,
      2,
    )
  }

  if (name === 'get_targets') {
    const rows = await ctx.runQuery(internal.runs.targetsInternal, { runId: args.run as Id<'runs'>, limit: 1000 })
    let list = rows
    if (args.country) list = list.filter((r) => r.country === String(args.country).toUpperCase())
    if (args.industry) list = list.filter((r) => r.industry === String(args.industry))
    const limit = typeof args.limit === 'number' ? args.limit : 20
    return JSON.stringify(
      list.slice(0, limit).map((r) => ({
        business_id: r.businessId,
        name: r.name,
        country: r.country,
        industry: `${r.industry} ${r.industryName}`,
        city: r.city,
        age: r.age,
        size: money(r.size, r.currency),
        change_pct: r.changePct === null ? null : Math.round(r.changePct),
        filed: r.filedAt,
        score: r.score,
        buyers: r.buyers.map((b) => b.name),
        status: r.status,
        verify: r.verifyUrl,
      })),
      null,
      2,
    )
  }

  if (name === 'explain') {
    const row = await ctx.runQuery(internal.runs.targetInternal, {
      runId: args.run as Id<'runs'>,
      businessId: String(args.business_id),
    })
    if (!row) return JSON.stringify({ error: 'not in this run' })
    return JSON.stringify(
      {
        business_id: row.businessId,
        name: row.name,
        country: row.country,
        industry: `${row.industry} ${row.industryName}`,
        registered: row.registered,
        age: row.age,
        figures: {
          basis: row.currency === 'NOK' ? 'revenue, from the filing' : 'balance sheet total, a size proxy — not revenue',
          size: money(row.size, row.currency),
          previous: row.sizePrev === null ? null : money(row.sizePrev, row.currency),
          change_pct: row.changePct === null ? null : Math.round(row.changePct),
          financial_period_end: row.financialDate,
          registered_at: row.filedAt,
        },
        score: row.score,
        headline: row.analysis.headline,
        findings: row.analysis.facts.map((f) => ({ [f.label]: f.value, basis: f.basis })),
        reasons: row.reasons.map((r) => `${r.label} (+${r.points})`),
        buyers: row.buyers.map((b) => ({ name: b.name, kind: b.kind, why: b.why, evidence: b.evidence, source: b.source })),
        limits: row.analysis.limits,
        open_questions: row.analysis.open,
        status: row.status,
        verify: row.verifyUrl,
        currency: CURRENCY[row.country],
      },
      null,
      2,
    )
  }

  throw new Error(`unknown tool: ${name}`)
}

type Rpc = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }

/** One JSON-RPC message in, one out — or null for a notification, which takes no reply. */
export async function handle(ctx: ActionCtx, msg: Rpc): Promise<unknown | null> {
  const { id, method, params } = msg
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

  try {
    if (method === 'initialize') {
      const asked = (params?.protocolVersion as string) || PROTOCOL
      return ok({
        protocolVersion: asked,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'originaatio', version: '1.0.0' },
        instructions:
          'Off-market origination over public company registers. start_run with criteria (or none, for the defaults), ' +
          'poll get_run until done, then get_targets. Nothing is ever sent to anyone: every target is awaiting_human.',
      })
    }
    if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return null
    if (method === 'ping') return ok({})
    if (method === 'tools/list') return ok({ tools: TOOLS })
    if (method === 'tools/call') {
      const name = params?.name as string
      const args = (params?.arguments as Record<string, unknown>) ?? {}
      try {
        const text = await call(ctx, name, args)
        return ok({ content: [{ type: 'text', text }], isError: false })
      } catch (err) {
        return ok({
          content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        })
      }
    }
    if (method === 'resources/list') return ok({ resources: [] })
    if (method === 'prompts/list') return ok({ prompts: [] })
    return fail(-32601, `method not found: ${method}`)
  } catch (err) {
    return fail(-32603, err instanceof Error ? err.message : String(err))
  }
}
