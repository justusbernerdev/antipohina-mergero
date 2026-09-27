import { v } from 'convex/values'
import { internalAction, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { Company, Filing, Financials } from './lib/types'
import { CURRENCY, PER_EURO, type Criteria } from './lib/criteria'
import { matchBuyers } from './lib/buyers'
import { analyse, type Analysis } from './lib/analysis'
import { ageOf, filingLagDays, score } from './lib/score'
import { mapLimit } from './lib/net'
import { EXCLUDE_NAME } from './lib/industries'
import * as FI from './sources/fi'
import * as NO from './sources/no'
import * as DK from './sources/dk'

/**
 * The engine, as one action.
 *
 * It runs on the platform rather than on a laptop, which was the constraint that shaped everything
 * else: no register download, every source filtered server-side, and the only heavy work is a few
 * hundred small HTTP requests. A Convex action gets thirty minutes; a full two-country run takes
 * about four.
 *
 * Countries run concurrently because they are genuinely independent — different registers,
 * different currencies, no shared state — and the diagram is built to show exactly that. Each lane
 * writes its own counters as it goes, which is why the view fills in rather than jumping from empty
 * to finished.
 */

/** Eight months from the end of the financial period is the Finnish statutory deadline. */
const DEADLINE_DAYS = 243

/** Bound on how many companies we will fetch accounts for per country in one run. */
const ACCOUNTS_CAP = 1200

const iso = (d: Date) => d.toISOString().slice(0, 10)

type Row = {
  country: string
  businessId: string
  name: string
  industry: string
  industryName: string
  city: string | null
  registered: string
  age: number
  currency: string
  size: number
  sizePrev: number | null
  changePct: number | null
  filedAt: string
  financialDate: string
  score: number
  reasons: { label: string; points: number }[]
  buyers: { id: string; name: string; kind: string; why: string; evidence: string; source: string }[]
  analysis: Analysis
  verifyUrl: string
  status: string
}

export const run = internalAction({
  args: { runId: v.id('runs') },
  handler: async (ctx, { runId }) => {
    const record = await ctx.runQuery(internal.runs.getInternal, { runId })
    if (!record) return
    const criteria = record.criteria as Criteria
    const asOf = new Date()

    await ctx.runMutation(internal.runs.setStatus, { runId, status: 'running' })
    await ctx.runMutation(internal.runs.setStage, {
      runId,
      key: 'criteria',
      in: criteria.industries.length,
      out: criteria.countries.length,
      state: 'done',
    })
    await ctx.runMutation(internal.runs.setStage, { runId, key: 'source', state: 'done' })

    try {
      const perCountry = await Promise.all(
        criteria.countries.map((country) => lane(ctx, runId, country, criteria, asOf)),
      )
      const kept = perCountry.flatMap((r) => r.rows)
      const totals = (i: number) => perCountry.reduce((s, r) => s + r.counts[i], 0)
      await ctx.runMutation(internal.runs.setStage, {
        runId,
        key: 'scoring',
        in: totals(3),
        out: totals(3),
        state: 'done',
      })
      await ctx.runMutation(internal.runs.setStage, {
        runId,
        key: 'buyers',
        in: totals(3),
        out: kept.filter((r) => r.buyers.length > 0).length,
        state: 'done',
      })

      await ctx.runMutation(internal.runs.setStatus, { runId, status: 'done' })
    } catch (err) {
      await ctx.runMutation(internal.runs.setStatus, {
        runId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },
})

/**
 * One country, end to end.
 *
 * The counts come back alongside the rows rather than as shared state: the funnel is about what did
 * *not* survive, and by the time the rows exist that information is gone. Two lanes run at once, so
 * nothing here may be module-level.
 */
async function lane(
  ctx: ActionCtx,
  runId: Id<'runs'>,
  country: string,
  criteria: Criteria,
  asOf: Date,
): Promise<{ rows: Row[]; counts: number[] }> {
  const began = Date.now()
  const counts = [0, 0, 0, 0]

  const push = (state: string, phase?: string, note?: string) =>
    ctx.runMutation(internal.runs.setLane, {
      runId,
      country,
      v: [...counts],
      state,
      ms: Date.now() - began,
      ...(phase ? { phase } : {}),
      ...(note ? { note } : {}),
    })

  /**
   * Progress is written at most every second and a half. More often and a long run spends its time
   * writing to the database instead of reading registers; less often and the lane looks stuck.
   */
  let lastPush = 0
  const report = (phase: string) => {
    const now = Date.now()
    if (now - lastPush < 1500) return
    lastPush = now
    void push('running', phase)
  }

  const currency = CURRENCY[country] ?? 'EUR'
  const minSize = criteria.minSize[country] ?? 0
  await push('running', 'Rekisteri')

  /* 01–03 · who exists, and which of them just filed */
  let companies: Company[]
  let filings: Filing[]
  const lastFiled = new Map<string, string>()
  const byId = new Map<string, Company>()

  if (country === 'DK') {
    /**
     * Denmark inverts the first two stages, because its stream is the strong signal and it is
     * dated. Start from what was published, then ask who those companies are.
     */
    const end = iso(asOf)
    const start = iso(new Date(asOf.getTime() - criteria.filingWindowDays * 864e5))
    const stream = await DK.filings(start, end, ACCOUNTS_CAP)
    counts[0] = stream.total
    await push('running', `Rekisteri · ${stream.rows.length} julkaisua`)

    let looked = 0
    const resolved = await mapLimit(stream.rows, 6, async (f) => {
      const c = await DK.company(f.businessId, criteria.industries, criteria.minAgeYears, criteria.excludeHolding, asOf, EXCLUDE_NAME)
      report(`Rekisteri · ${++looked}/${stream.rows.length}`)
      return c ? ({ company: c, filing: f } as const) : null
    })
    const kept = resolved.filter((x): x is NonNullable<typeof x> => x !== null)
    companies = kept.map((x) => x.company)
    filings = kept.map((x) => x.filing)
    counts[1] = companies.length
    counts[2] = filings.length
    for (const c of companies) byId.set(c.businessId, c)
    await push('running', `Luvut · 0/${filings.length}`)
  } else {
    const onProgress = (universe: number, kept: number, done: number, total: number) => {
      counts[0] = universe
      counts[1] = kept
      report(`Rekisteri · ${done}/${total} toimialaa`)
    }
    if (country === 'NO') {
      const r = await NO.companies(criteria.industries, criteria.minAgeYears, criteria.excludeHolding, asOf, onProgress)
      counts[0] = r.universe
      companies = r.rows
      for (const [k, v2] of r.lastFiled) lastFiled.set(k, v2)
    } else {
      const r = await FI.companies(criteria.industries, criteria.minAgeYears, criteria.excludeHolding, asOf, onProgress)
      counts[0] = r.universe
      companies = r.rows
    }
    counts[1] = companies.length
    for (const c of companies) byId.set(c.businessId, c)
    await push('running', 'Tilinpäätösvirta')

    if (country === 'NO') {
      // Norway publishes no dated stream. Having filed accounts at all is the equivalent fact.
      filings = companies
        .filter((c) => lastFiled.has(c.businessId))
        .map((c) => ({ businessId: c.businessId, financialDate: `${lastFiled.get(c.businessId)}-12-31`, registrationDate: '' }))
    } else {
      const end = iso(asOf)
      const start = iso(new Date(asOf.getTime() - criteria.filingWindowDays * 864e5))
      const stream = await FI.filings(start, end)
      // The endpoint returns a company's whole filing history once it appears; keep the new ones.
      const fresh = stream.filter((f) => f.registrationDate >= start && f.registrationDate <= end)
      const seen = new Set<string>()
      filings = []
      for (const f of fresh.sort((a, b) => b.registrationDate.localeCompare(a.registrationDate))) {
        if (!byId.has(f.businessId) || seen.has(f.businessId)) continue
        seen.add(f.businessId)
        filings.push(f)
      }
    }
    counts[2] = filings.length
    await push('running', `Luvut · 0/${Math.min(filings.length, ACCOUNTS_CAP)}`)
  }

  /* 04 · the figures, read from the filing rather than estimated */
  const capped = filings.slice(0, ACCOUNTS_CAP)
  const note = filings.length > ACCOUNTS_CAP ? `rajattu ${ACCOUNTS_CAP} tuoreimpaan` : undefined
  let read = 0
  const fetched = await mapLimit(capped, 8, async (f) => {
    const out = country === 'NO' ? await NO.financials(f) : country === 'DK' ? await DK.financials(f) : await FI.financials(f)
    report(`Luvut · ${++read}/${capped.length}`)
    return out
  })

  const survivors: { company: Company; fin: Financials }[] = []
  for (let i = 0; i < capped.length; i++) {
    const fin = fetched[i]
    const company = byId.get(capped[i].businessId)
    if (!fin || !company) continue
    if (fin.balanceProxy < minSize) continue
    survivors.push({ company, fin })
  }
  counts[3] = survivors.length
  await push('running', 'Pisteytys ja ostajat', note)

  /* 05–06 · scoring ranks, buyers filter, and the draft is written from what we just read */
  const personName = country === 'NO' ? NO.hasPersonName : undefined
  const perEuro = PER_EURO[country] ?? 1
  const rows: Row[] = survivors.map(({ company, fin }) => {
    const scored = score(company, fin, undefined, asOf, personName)

    /**
     * Norway's timing signal, since there is no dated filing stream to read it from.
     *
     * The register does say which year was last filed, and the deadline is the July after the
     * period ends. A company still showing 2023 in late 2026 is two years behind, which is the same
     * observation a late Finnish filing makes — arrived at from the other direction.
     */
    if (country === 'NO') {
      const filedYear = Number(lastFiled.get(company.businessId))
      if (Number.isFinite(filedYear)) {
        const behind = asOf.getFullYear() - 1 - filedYear
        if (behind >= 2) scored.reasons.push({ label: `Viimeisin tilinpäätös ${filedYear}, ${behind} vuotta jäljessä`, points: 4 })
        else if (behind === 1) scored.reasons.push({ label: `Viimeisin tilinpäätös ${filedYear}, vuosi jäljessä`, points: 3 })
        else scored.reasons.push({ label: `Tilinpäätös ${filedYear} jätetty ajallaan`, points: 1 })
        scored.score = scored.reasons.reduce((s, r) => s + r.points, 0)
      }
    }

    const matches = matchBuyers(company, fin, perEuro)
    const lateMonths = Math.max(0, Math.floor((filingLagDays(fin) - DEADLINE_DAYS) / 30))
    return {
      country,
      businessId: company.businessId,
      name: company.name,
      industry: company.industry,
      industryName: company.industryName,
      city: company.city,
      registered: company.registered,
      age: ageOf(company, asOf),
      currency,
      size: fin.balanceProxy,
      sizePrev: fin.balanceProxyPrev,
      changePct: fin.changePct,
      filedAt: fin.registrationDate,
      financialDate: fin.financialDate,
      score: scored.score,
      reasons: scored.reasons,
      buyers: matches.map(({ buyer, why }) => ({
        id: buyer.id,
        name: buyer.name,
        kind: buyer.kind,
        why,
        evidence: buyer.evidence,
        source: buyer.source,
      })),
      analysis: analyse(
        company,
        fin,
        matches,
        country,
        currency,
        ageOf(company, asOf),
        lateMonths,
        country === 'NO' ? (Number(lastFiled.get(company.businessId)) || null) : null,
      ),
      verifyUrl:
        country === 'NO' ? NO.verifyUrl(company.businessId) : country === 'DK' ? DK.verifyUrl(company.businessId) : FI.verifyUrl(company.businessId),
      status: 'awaiting_human',
    }
  })

  // Highest score first, capped per country, and written now so the feed fills as this lane lands.
  rows.sort((a, b) => b.score - a.score)
  const kept = rows.slice(0, criteria.limit)
  for (let i = 0; i < kept.length; i += 100) {
    await ctx.runMutation(internal.runs.addTargets, { runId, rows: kept.slice(i, i + 100) })
  }

  await ctx.runMutation(internal.runs.setLane, {
    runId,
    country,
    v: [...counts],
    buyers: kept.filter((r) => r.buyers.length > 0).length,
    state: 'done',
    ms: Date.now() - began,
    ...(note ? { note } : {}),
  })

  return { rows: kept, counts }
}
