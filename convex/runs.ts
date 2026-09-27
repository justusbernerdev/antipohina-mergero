import { v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { normalize } from './lib/criteria'

/**
 * A run's life, from criteria to a list of owners.
 *
 * `start` is the only way in, and it is deliberately the same door for the UI, the REST API and the
 * MCP server. Whatever asked for the run is recorded on it, so it is possible to answer "does
 * anyone actually use the MCP surface" with a query rather than an opinion.
 */

/**
 * Everything the working surface touches requires a signed-in person.
 *
 * The HTTP API and the MCP endpoint carry bearer keys instead, checked in `http.ts`; they reach
 * these functions through `ctx.runQuery` from an action, where the check does not apply. Two doors,
 * two locks, and neither one standing in for the other.
 */
async function requireUser(ctx: { auth: { getUserIdentity: () => Promise<unknown> } }) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('unauthorized')
}

/** The seven boxes of the diagram, in order. Index 1–4 are the per-country lanes. */
export const STAGE_KEYS = ['criteria', 'source', 'register', 'filings', 'financials', 'scoring', 'buyers']

export const start = mutation({
  args: { criteria: v.optional(v.any()), source: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx)
    const criteria = normalize(args.criteria)
    const runId = await ctx.db.insert('runs', {
      criteria,
      status: 'queued',
      stages: STAGE_KEYS.map((key) => ({ key, in: 0, out: 0, state: 'waiting' })),
      lanes: criteria.countries.map((country) => ({ country, v: [0, 0, 0, 0], buyers: 0, state: 'waiting' })),
      source: args.source ?? 'ui',
      startedAt: Date.now(),
      targetCount: 0,
    })
    await ctx.scheduler.runAfter(0, internal.pipeline.run, { runId })
    return runId
  },
})

export const get = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, { runId }) => {
    await requireUser(ctx)
    return await ctx.db.get(runId)
  },
})

/** What the diagram subscribes to when nobody has started anything yet. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    return await ctx.db.query('runs').withIndex('by_started').order('desc').first()
  },
})

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireUser(ctx)
    return await ctx.db.query('runs').withIndex('by_started').order('desc').take(Math.min(limit ?? 20, 100))
  },
})

export const targets = query({
  args: { runId: v.id('runs'), limit: v.optional(v.number()) },
  handler: async (ctx, { runId, limit }) => {
    await requireUser(ctx)
    const rows = await ctx.db.query('targets').withIndex('by_run', (q) => q.eq('runId', runId)).collect()
    rows.sort((a, b) => b.score - a.score)
    return rows.slice(0, Math.min(limit ?? 100, 1000))
  },
})

export const target = query({
  args: { runId: v.id('runs'), businessId: v.string() },
  handler: async (ctx, { runId, businessId }) => {
    await requireUser(ctx)
    const rows = await ctx.db.query('targets').withIndex('by_run', (q) => q.eq('runId', runId)).collect()
    return rows.find((r) => r.businessId === businessId) ?? null
  },
})

/**
 * One company, found without knowing which run it came from.
 *
 * This is what the owner's own page needs: someone follows a link with a business ID in it and has
 * no idea what a run is. The most recent run that contains them is the right answer, because that
 * is the freshest set of figures we have read about them.
 */
/* Deliberately open: this is the one an owner follows a link into. */
export const findTarget = query({
  args: { businessId: v.string() },
  handler: async (ctx, { businessId }) => {
    const runs = await ctx.db.query('runs').withIndex('by_started').order('desc').take(25)
    for (const run of runs) {
      const rows = await ctx.db.query('targets').withIndex('by_run', (q) => q.eq('runId', run._id)).collect()
      const hit = rows.find((r) => r.businessId === businessId)
      if (hit) return { target: hit, runStartedAt: run.startedAt }
    }
    return null
  },
})

/* ---------------------------------------------------------------- internal */

/**
 * The same three reads and the one write, without the session check.
 *
 * The HTTP surface authenticates with a bearer key in `http.ts` before it gets here, and an action
 * carries no Clerk identity to hand on. Rather than weaken the public functions so both paths fit
 * through one door, the machine path gets its own.
 */
export const startInternal = internalMutation({
  args: { criteria: v.optional(v.any()), source: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const criteria = normalize(args.criteria)
    const runId = await ctx.db.insert('runs', {
      criteria,
      status: 'queued',
      stages: STAGE_KEYS.map((key) => ({ key, in: 0, out: 0, state: 'waiting' })),
      lanes: criteria.countries.map((country) => ({ country, v: [0, 0, 0, 0], buyers: 0, state: 'waiting' })),
      source: args.source ?? 'api',
      startedAt: Date.now(),
      targetCount: 0,
    })
    await ctx.scheduler.runAfter(0, internal.pipeline.run, { runId })
    return runId
  },
})

export const listInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) =>
    await ctx.db.query('runs').withIndex('by_started').order('desc').take(Math.min(limit ?? 20, 100)),
})

export const targetsInternal = internalQuery({
  args: { runId: v.id('runs'), limit: v.optional(v.number()) },
  handler: async (ctx, { runId, limit }) => {
    const rows = await ctx.db.query('targets').withIndex('by_run', (q) => q.eq('runId', runId)).collect()
    rows.sort((a, b) => b.score - a.score)
    return rows.slice(0, Math.min(limit ?? 100, 1000))
  },
})

export const targetInternal = internalQuery({
  args: { runId: v.id('runs'), businessId: v.string() },
  handler: async (ctx, { runId, businessId }) => {
    const rows = await ctx.db.query('targets').withIndex('by_run', (q) => q.eq('runId', runId)).collect()
    return rows.find((r) => r.businessId === businessId) ?? null
  },
})

export const getInternal = internalQuery({
  args: { runId: v.id('runs') },
  handler: async (ctx, { runId }) => await ctx.db.get(runId),
})

export const setStatus = internalMutation({
  args: { runId: v.id('runs'), status: v.string(), error: v.optional(v.string()), targetCount: v.optional(v.number()) },
  handler: async (ctx, { runId, status, error, targetCount }) => {
    const patch: Record<string, unknown> = { status }
    if (error !== undefined) patch.error = error
    if (targetCount !== undefined) patch.targetCount = targetCount
    if (status === 'done' || status === 'error') patch.finishedAt = Date.now()
    await ctx.db.patch(runId, patch)
  },
})

export const setStage = internalMutation({
  args: {
    runId: v.id('runs'),
    key: v.string(),
    in: v.optional(v.number()),
    out: v.optional(v.number()),
    state: v.optional(v.string()),
    ms: v.optional(v.number()),
  },
  handler: async (ctx, { runId, key, ...rest }) => {
    const run = await ctx.db.get(runId)
    if (!run) return
    const stages = run.stages.map((s) =>
      s.key === key
        ? { ...s, in: rest.in ?? s.in, out: rest.out ?? s.out, state: rest.state ?? s.state, ms: rest.ms ?? s.ms }
        : s,
    )
    await ctx.db.patch(runId, { stages })
  },
})

export const setLane = internalMutation({
  args: {
    runId: v.id('runs'),
    country: v.string(),
    v: v.optional(v.array(v.number())),
    buyers: v.optional(v.number()),
    state: v.optional(v.string()),
    ms: v.optional(v.number()),
    note: v.optional(v.string()),
    phase: v.optional(v.string()),
  },
  handler: async (ctx, { runId, country, ...rest }) => {
    const run = await ctx.db.get(runId)
    if (!run) return
    const lanes = run.lanes.map((l) =>
      l.country === country
        ? {
            ...l,
            v: rest.v ?? l.v,
            buyers: rest.buyers ?? l.buyers,
            state: rest.state ?? l.state,
            ms: rest.ms ?? l.ms,
            note: rest.note ?? l.note,
            phase: rest.phase ?? l.phase,
          }
        : l,
    )
    await ctx.db.patch(runId, { lanes })
  },
})

/**
 * Targets are written as each country finishes rather than all at once at the end, so the feed
 * fills while the engine is still working. Without this the view sits empty for four minutes and
 * then jumps, which reads as a page that loaded late rather than an engine that ran.
 */
export const addTargets = internalMutation({
  args: { runId: v.id('runs'), rows: v.array(v.any()) },
  handler: async (ctx, { runId, rows }) => {
    for (const row of rows) await ctx.db.insert('targets', { ...row, runId })
    const run = await ctx.db.get(runId)
    if (run) await ctx.db.patch(runId, { targetCount: run.targetCount + rows.length })
  },
})
