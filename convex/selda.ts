import { v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * The contact layer, called rather than rebuilt.
 *
 * The engine finds a company. Turning a company into a person — who to write to, at what address,
 * with what opening — is a different problem that is already solved, so this file calls Selda over
 * its MCP endpoint instead of implementing a second version of it badly.
 *
 * The division of labour is the point and it is worth stating plainly: the engine decides WHO and
 * WHEN and hands over its reasoning; Selda decides WHOM TO WRITE TO and drafts the words; a human
 * decides whether anything is sent. Nothing here sends. Selda's own contract is that a draft waits
 * for approval inside Selda, and there is no parameter on either side that changes that.
 *
 * Credentials live in the deployment, never in the repository:
 *   npx convex env set SELDA_KEY sk_live_...
 *   npx convex env set SELDA_PROJECT <projectId>
 */

const ENDPOINT = 'https://mcp.selda.ai/api/mcp'

type RpcResult = { content?: { type: string; text?: string }[]; isError?: boolean }

/** One JSON-RPC tool call against Selda. Returns the text payload, parsed if it is JSON. */
async function callSelda(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const key = process.env.SELDA_KEY
  if (!key) throw new Error('SELDA_KEY is not set on this deployment')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  })
  if (!res.ok) throw new Error(`Selda ${tool}: ${res.status} ${(await res.text()).slice(0, 200)}`)

  const body = await res.text()
  // Some MCP servers answer a plain POST as a single SSE frame; accept both shapes.
  const jsonText = body.startsWith('data:') ? body.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim() ?? '{}' : body
  const parsed = JSON.parse(jsonText) as { result?: RpcResult; error?: { message?: string } }
  if (parsed.error) throw new Error(`Selda ${tool}: ${parsed.error.message ?? 'rpc error'}`)

  const text = parsed.result?.content?.find((c) => c.type === 'text')?.text ?? ''
  if (parsed.result?.isError) throw new Error(`Selda ${tool}: ${text.slice(0, 200)}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const pick = (o: unknown, ...keys: string[]): string | undefined => {
  if (!o || typeof o !== 'object') return undefined
  for (const k of keys) {
    const val = (o as Record<string, unknown>)[k]
    if (typeof val === 'string' && val) return val
  }
  return undefined
}

/**
 * Hand one target to Selda, with the analysis attached.
 *
 * `analysis` matters more than it looks. Without it Selda would crawl the company from scratch and
 * write from whatever a website says; with it, the opening is written from figures that came out of
 * the company's own registered filing and can be checked against the register in a minute.
 */
export const send = action({
  args: { runId: v.id('runs'), businessId: v.string() },
  handler: async (ctx, { runId, businessId }): Promise<{ ok: boolean; state: string; error?: string }> => {
    const projectId = process.env.SELDA_PROJECT
    if (!projectId) throw new Error('SELDA_PROJECT is not set on this deployment')

    const row = await ctx.runQuery(api.runs.target, { runId, businessId })
    if (!row) throw new Error('not in this run')

    await ctx.runMutation(internal.selda.setState, { runId, businessId, patch: { state: 'sending' } })

    const a = row.analysis
    const analysis = [
      a.headline,
      '',
      ...a.facts.map((f) => `${f.label}: ${f.value}${f.basis ? ` (${f.basis})` : ''}`),
      '',
      `Pisteytys ${row.score}: ${row.reasons.map((r) => `${r.label} +${r.points}`).join(', ')}`,
      row.buyers.length
        ? `Ostajat joiden kriteerit täyttyvät: ${row.buyers.map((b) => `${b.name} (${b.evidence})`).join(' | ')}`
        : 'Yksikään ostajakriteeri ei täyty tässä kokoluokassa.',
      '',
      `Mitä julkinen data ei kerro: ${a.limits.join(' ')}`,
      `Auki: ${a.open.join(' ')}`,
      `Tarkistettavissa: ${row.verifyUrl}`,
    ].join('\n')

    try {
      /**
       * `selda_add_lead` rather than the inbound-event tool, because we do not know a person yet.
       * That is the whole division of labour: the engine knows the company and why, Selda works out
       * who to write to. Passing `analysis` is what stops it crawling the website and inventing an
       * angle — the opening is written from figures out of the company's own registered filing.
       */
      const out = await callSelda('selda_add_lead', {
        projectId,
        company: row.name,
        source: 'originaatio',
        analysis,
        whyGoodLead: [
          `${row.age} v, ${row.industry} ${row.industryName}, ${row.city ?? ''}`,
          `Pisteytys ${row.score}: ${row.reasons.map((r) => r.label).join(', ')}`,
          row.buyers.length
            ? `Ostajakirjassa ${row.buyers.length} osumaa: ${row.buyers.map((b) => b.name).join(', ')}`
            : 'Ei ostajaosumia nykyisillä kriteereillä.',
        ].join(' | '),
        outreachAngle:
          row.buyers.length > 0
            ? `Kerro omistajalle mitä julkinen tilinpäätös näyttää ja että ostajakirjassa on ${row.buyers.length} ostajaa joiden toimiala- ja kokoluokkakriteerit täyttyvät. Älä lupaa hintaa. Älä väitä mitään mitä analyysissä ei lue.`
            : 'Kerro omistajalle mitä julkinen tilinpäätös näyttää. Älä lupaa ostajia: yksikään kriteeri ei täyty tässä kokoluokassa.',
        notes: `originaatio run ${runId} · ${row.businessId} · ${row.verifyUrl}`,
      })

      const leadId = pick(out, 'leadId', 'id', 'lead_id')
      await ctx.runMutation(internal.selda.setState, {
        runId,
        businessId,
        patch: { state: 'sent', leadId, sentAt: Date.now(), raw: JSON.stringify(out).slice(0, 4000) },
      })
      return { ok: true, state: 'sent' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await ctx.runMutation(internal.selda.setState, { runId, businessId, patch: { state: 'error', error: message } })
      return { ok: false, state: 'error', error: message }
    }
  },
})

/**
 * Read back what Selda made of it: the decision maker it found, and the draft waiting for approval.
 *
 * Selda fires a webhook when a draft is ready, but a pull is what makes the loop visible on demand
 * rather than only when something happens to arrive.
 */
export const pull = action({
  args: { runId: v.id('runs'), businessId: v.string() },
  handler: async (ctx, { runId, businessId }): Promise<{ ok: boolean; error?: string }> => {
    const projectId = process.env.SELDA_PROJECT
    if (!projectId) throw new Error('SELDA_PROJECT is not set on this deployment')
    const row = await ctx.runQuery(api.runs.target, { runId, businessId })
    if (!row?.selda?.leadId) return { ok: false, error: 'not sent yet' }

    try {
      const lead = (await callSelda('selda_get_lead', { leadId: row.selda.leadId })) as Record<string, unknown>
      const l = (lead?.lead as Record<string, unknown>) ?? lead ?? {}
      const contact = [pick(l, 'firstName'), pick(l, 'lastName')].filter(Boolean).join(' ') || pick(l, 'name')

      // The draft may come back on the lead itself or in a small list beside it; accept either.
      const drafts = (lead?.drafts ?? lead?.messages ?? l.drafts ?? l.messages) as unknown
      const list = Array.isArray(drafts) ? drafts : []
      const first = list.find((m) => typeof m === 'object' && m !== null) as Record<string, unknown> | undefined
      const draft = pick(lead, 'draft') ?? pick(l, 'draft') ?? (first ? pick(first, 'body', 'text', 'content') : undefined)

      await ctx.runMutation(internal.selda.setState, {
        runId,
        businessId,
        patch: {
          state: draft ? 'draft_ready' : (pick(l, 'status') ?? row.selda.state),
          contact,
          contactTitle: pick(l, 'jobTitle', 'title'),
          contactEmail: pick(l, 'email'),
          draft,
        },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
})

export const setState = internalMutation({
  args: { runId: v.id('runs'), businessId: v.string(), patch: v.any() },
  handler: async (ctx, { runId, businessId, patch }) => {
    const rows = await ctx.db
      .query('targets')
      .withIndex('by_run', (q) => q.eq('runId', runId as Id<'runs'>))
      .collect()
    const row = rows.find((r) => r.businessId === businessId)
    if (!row) return
    await ctx.db.patch(row._id, { selda: { ...(row.selda ?? {}), ...patch } })
  },
})
