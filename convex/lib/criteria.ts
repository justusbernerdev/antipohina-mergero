import { CONSOLIDATING } from './industries'

/**
 * What a caller is allowed to ask for, and what they get if they do not ask.
 *
 * Defaults exist per country because the countries are not comparable: Finland publishes a balance
 * sheet total and Norway publishes revenue, so "at least 1.5M" means a different thing in each and
 * cannot be one number. Everything else is shared.
 */

export type Criteria = {
  countries: string[]
  industries: string[]
  minAgeYears: number
  minSize: Record<string, number>
  filingWindowDays: number
  excludeHolding: boolean
  limit: number
}

export const SUPPORTED = ['FI', 'NO'] as const

/** Local currency, because a size threshold stated in the wrong one is worse than none. */
export const CURRENCY: Record<string, string> = { FI: 'EUR', NO: 'NOK' }

/** Units of local currency per euro, for comparing a target against a buyer book stated in euros. */
export const PER_EURO: Record<string, number> = { FI: 1, NO: 11.7 }

export const DEFAULT_MIN_SIZE: Record<string, number> = {
  /** Balance sheet total. A size proxy, not revenue: a Finnish micro company publishes neither. */
  FI: 1_500_000,
  /** Revenue, which Norway publishes directly. Roughly the same company at 11.7 NOK to the euro. */
  NO: 15_000_000,
}

export const DEFAULTS: Criteria = {
  countries: ['FI'],
  industries: Object.keys(CONSOLIDATING),
  minAgeYears: 15,
  minSize: DEFAULT_MIN_SIZE,
  filingWindowDays: 70,
  excludeHolding: true,
  limit: 200,
}

const num = (x: unknown, fallback: number, lo: number, hi: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : fallback

/**
 * Accept what a caller sends and return something the pipeline can run.
 *
 * Unknown countries and industry codes are dropped rather than rejected: an agent writing criteria
 * in plain language will guess a code sooner or later, and failing the whole run over one bad entry
 * is the wrong trade. What cannot be salvaged throws.
 */
export function normalize(input: unknown): Criteria {
  const c = (input ?? {}) as Record<string, unknown>

  const countries = Array.isArray(c.countries)
    ? c.countries.map(String).map((s) => s.toUpperCase()).filter((s) => (SUPPORTED as readonly string[]).includes(s))
    : DEFAULTS.countries
  if (!countries.length) {
    throw new Error(`countries: pick at least one of ${SUPPORTED.join(', ')}`)
  }

  // "43*" expands to every consolidating code starting 43. An agent will write the prefix.
  const asked = Array.isArray(c.industries) ? c.industries.map(String) : null
  const all = Object.keys(CONSOLIDATING)
  const industries = asked
    ? [...new Set(asked.flatMap((p) => (p.endsWith('*') ? all.filter((k) => k.startsWith(p.slice(0, -1))) : all.filter((k) => k === p))))]
    : all
  if (!industries.length) {
    throw new Error('industries: none of the codes given are in the consolidating set')
  }

  const minSize: Record<string, number> = { ...DEFAULT_MIN_SIZE }
  if (c.minSize && typeof c.minSize === 'object') {
    for (const [k, val] of Object.entries(c.minSize as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) minSize[k.toUpperCase()] = Math.max(0, val)
    }
  }

  return {
    countries,
    industries,
    minAgeYears: num(c.minAgeYears, DEFAULTS.minAgeYears, 0, 100),
    minSize,
    filingWindowDays: num(c.filingWindowDays, DEFAULTS.filingWindowDays, 1, 365),
    excludeHolding: typeof c.excludeHolding === 'boolean' ? c.excludeHolding : true,
    limit: num(c.limit, DEFAULTS.limit, 1, 1000),
  }
}

/** The industry list is long; the caller should be able to read it back in one line. */
export const industryLabel = (code: string) => CONSOLIDATING[code] ?? code
