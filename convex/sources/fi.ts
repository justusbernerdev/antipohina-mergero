import type { Company, Filing, Financials } from '../lib/types'
import { CONSOLIDATING, EXCLUDE_NAME } from '../lib/industries'
import { fetchJson, fetchText, mapLimit } from '../lib/net'
import { parseFiling } from '../lib/xbrl'

/**
 * Finland · PRH open data, without the 97 MB download.
 *
 * The earlier version of this pipeline pulled the whole trade register as a daily zip and filtered
 * it locally, which is fine on a laptop and impossible inside a function. The v3 company endpoint
 * filters on the server — industry, company form and registration date all go in the query — so the
 * same population arrives as a few hundred pages of JSON instead of 1.5 GB of it.
 *
 * That single change is what lets the engine run on a platform rather than on someone's machine.
 */

const YTJ = 'https://avoindata.prh.fi/opendata-ytj-api/v3'
const XBRL = 'https://avoindata.prh.fi/opendata-xbrl-api/v3'

/** Limited company. The register's own code, not ours. */
const OY = 'OY'
/** Trade-register status 1 is "in the register"; 4 is a company that has ceased. */
const ACTIVE = '1'
/** Register 7 is the employer register: real payroll, so a real business rather than a shell. */
const EMPLOYER_REGISTER = '7'

export const currency = 'EUR'
export const verifyUrl = (businessId: string) => `https://tietopalvelu.ytj.fi/yritys/${businessId}`

type PrhName = { name: string; type: string; endDate?: string }
type PrhEntry = { register?: string; endDate?: string }
type PrhCompany = {
  businessId?: { value: string; registrationDate?: string }
  names?: PrhName[]
  mainBusinessLine?: { type?: string; descriptions?: { languageCode: string; description: string }[] }
  addresses?: { type: number; postCode?: string; postOffices?: { city: string; languageCode: string }[] }[]
  registeredEntries?: PrhEntry[]
  website?: { url?: string }
  tradeRegisterStatus?: string
  registrationDate?: string
}

function toCompany(c: PrhCompany, industry: string): Company | null {
  const businessId = c.businessId?.value
  if (!businessId) return null

  // Type 1 is the registered company name; the ones with an end date are what it used to be called.
  const named = (c.names ?? []).filter((n) => n.type === '1')
  const current = named.find((n) => !n.endDate) ?? named[0]
  if (!current) return null

  const visiting = (c.addresses ?? []).find((a) => a.type === 1) ?? (c.addresses ?? [])[0]
  const city = visiting?.postOffices?.find((p) => p.languageCode === '1')?.city ?? visiting?.postOffices?.[0]?.city ?? null

  const fi = c.mainBusinessLine?.descriptions?.find((d) => d.languageCode === '1')?.description

  return {
    businessId,
    name: current.name,
    registered: c.businessId?.registrationDate ?? c.registrationDate ?? '',
    industry,
    industryName: CONSOLIDATING[industry] ?? fi ?? industry,
    renames: Math.max(0, named.length - 1),
    postCode: visiting?.postCode ?? null,
    city,
    website: c.website?.url ?? null,
    employer: (c.registeredEntries ?? []).some((e) => e.register === EMPLOYER_REGISTER && !e.endDate),
  }
}

/**
 * Every active limited company in the given industries that is old enough, with the reasons it was
 * dropped counted rather than discarded. `universe` is what the register answered before we applied
 * anything of our own — the honest denominator for the funnel.
 */
export async function companies(
  industries: string[],
  minAgeYears: number,
  excludeHolding: boolean,
  asOf: Date,
  /**
   * Called after every industry, because PRH answers a page in about three seconds and a run over
   * fifty industries would otherwise show nothing at all for two minutes. A lane that counts up is
   * the difference between "working" and "broken" to anyone watching.
   */
  onProgress?: (universe: number, kept: number, done: number, total: number) => void,
): Promise<{ universe: number; rows: Company[] }> {
  const cutoff = `${asOf.getFullYear() - minAgeYears}-12-31`
  let universe = 0
  const rows: Company[] = []

  // One industry at a time, but the pages within an industry go out together.
  let done = 0
  for (const industry of industries) {
    const base = `${YTJ}/companies?mainBusinessLine=${industry}&companyForm=${OY}&registrationDateStart=1900-01-01&registrationDateEnd=${cutoff}`
    let first: { totalResults: number; companies: PrhCompany[] }
    try {
      first = await fetchJson<{ totalResults: number; companies: PrhCompany[] }>(`${base}&page=1`)
    } catch {
      onProgress?.(universe, rows.length, ++done, industries.length)
      continue
    }
    const total = first.totalResults ?? 0
    universe += total
    if (!total) {
      onProgress?.(universe, rows.length, ++done, industries.length)
      continue
    }

    const pages = Math.min(Math.ceil(total / 100), 200)
    const batches: PrhCompany[][] = [first.companies ?? []]
    if (pages > 1) {
      const rest = await mapLimit(
        Array.from({ length: pages - 1 }, (_, k) => k + 2),
        10,
        async (page) => {
          try {
            const d = await fetchJson<{ companies: PrhCompany[] }>(`${base}&page=${page}`)
            return d.companies ?? []
          } catch {
            return []
          }
        },
      )
      batches.push(...rest)
    }

    for (const batch of batches) {
      for (const raw of batch) {
        if (raw.tradeRegisterStatus !== ACTIVE) continue
        const company = toCompany(raw, industry)
        if (!company || !company.registered) continue
        if (excludeHolding && EXCLUDE_NAME.test(company.name)) continue
        rows.push(company)
      }
    }
    onProgress?.(universe, rows.length, ++done, industries.length)
  }

  return { universe, rows }
}

/**
 * The filing stream: every digital financial statement registered between two dates.
 *
 * This is the timing signal and the reason the pipeline is a weekly rhythm rather than a one-off
 * scan. A freshly registered filing means the owner has just looked at their own numbers.
 */
export async function filings(start: string, end: string): Promise<Filing[]> {
  const base = `${XBRL}/all_financial_statements?registeredDateStart=${start}&registeredDateEnd=${end}`
  const first = await fetchJson<{ totalResults: number; financials: Filing[] }>(`${base}&page=1`)
  const total = first.totalResults ?? 0
  const pages = Math.min(Math.ceil(total / 100), 400)
  const out = [...(first.financials ?? [])]

  if (pages > 1) {
    const rest = await mapLimit(
      Array.from({ length: pages - 1 }, (_, k) => k + 2),
      10,
      async (page) => {
        try {
          const d = await fetchJson<{ financials: Filing[] }>(`${base}&page=${page}`)
          return d.financials ?? []
        } catch {
          return []
        }
      },
    )
    for (const r of rest) out.push(...r)
  }
  return out
}

/** One filing as raw XBRL. The comparative period is in the same document, so direction is free. */
export async function financials(f: Filing): Promise<Financials | null> {
  try {
    const xml = await fetchText(`${XBRL}/financial?businessId=${f.businessId}&financialDate=${f.financialDate}`)
    return parseFiling(xml, f.businessId, f.financialDate, f.registrationDate)
  } catch {
    return null
  }
}
