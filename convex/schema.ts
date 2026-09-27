import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Three tables, and only one of them is interesting.
 *
 * A run is the unit of work: criteria in, a list of scored owners out, and a record of what the
 * pipeline did on the way. The stage counters live on the run document rather than in a log,
 * because the diagram subscribes to that document and fills as the numbers land. That is the whole
 * reason the store is reactive.
 */

/** One lane of the diagram: a country, and what survived each of its four stages. */
const lane = v.object({
  country: v.string(),
  /** register universe → after local exclusion → filed in window → passed the size band */
  v: v.array(v.number()),
  buyers: v.number(),
  state: v.string(),
  ms: v.optional(v.number()),
  note: v.optional(v.string()),
  /** What this lane is doing right now, written while it works so the view is not a blank box. */
  phase: v.optional(v.string()),
})

const stage = v.object({
  key: v.string(),
  in: v.number(),
  out: v.number(),
  state: v.string(),
  ms: v.optional(v.number()),
})

export default defineSchema({
  runs: defineTable({
    criteria: v.object({
      countries: v.array(v.string()),
      industries: v.array(v.string()),
      minAgeYears: v.number(),
      /** Minimum size in local currency, per country. Finland reads a balance sheet, Norway revenue. */
      minSize: v.record(v.string(), v.number()),
      filingWindowDays: v.number(),
      excludeHolding: v.boolean(),
      limit: v.number(),
    }),
    status: v.string(),
    stages: v.array(stage),
    lanes: v.array(lane),
    /** ui | api | mcp — worth knowing which surface actually gets used. */
    source: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    targetCount: v.number(),
  }).index('by_started', ['startedAt']),

  targets: defineTable({
    runId: v.id('runs'),
    country: v.string(),
    businessId: v.string(),
    name: v.string(),
    industry: v.string(),
    industryName: v.string(),
    city: v.union(v.string(), v.null()),
    registered: v.string(),
    age: v.number(),
    currency: v.string(),
    size: v.number(),
    sizePrev: v.union(v.number(), v.null()),
    changePct: v.union(v.number(), v.null()),
    filedAt: v.string(),
    financialDate: v.string(),
    score: v.number(),
    reasons: v.array(v.object({ label: v.string(), points: v.number() })),
    buyers: v.array(v.object({ id: v.string(), name: v.string(), kind: v.string(), why: v.string(), evidence: v.string(), source: v.string() })),
    analysis: v.object({
      headline: v.string(),
      facts: v.array(v.object({ label: v.string(), value: v.string(), basis: v.optional(v.string()) })),
      limits: v.array(v.string()),
      open: v.array(v.string()),
    }),
    verifyUrl: v.string(),
    status: v.string(),
    /**
     * What the contact layer did with this row. Absent until someone hands it over, because the
     * engine's job ends at "this company, and here is why".
     */
    selda: v.optional(
      v.object({
        state: v.optional(v.string()),
        leadId: v.optional(v.string()),
        sentAt: v.optional(v.number()),
        contact: v.optional(v.string()),
        contactTitle: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        draft: v.optional(v.string()),
        error: v.optional(v.string()),
        raw: v.optional(v.string()),
      }),
    ),
  })
    .index('by_run', ['runId'])
    .index('by_run_score', ['runId', 'score']),

  keys: defineTable({
    secret: v.string(),
    label: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    calls: v.number(),
  }).index('by_secret', ['secret']),
})
