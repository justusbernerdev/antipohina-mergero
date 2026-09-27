import type { Company, Filing, Financials } from '../lib/types'
import { CONSOLIDATING } from '../lib/industries'
import { fetchJson, fetchText } from '../lib/net'

/**
 * Denmark · Erhvervsstyrelsen.
 *
 * The funnel runs in a different order here, and that is the right way round rather than a
 * compromise. Denmark publishes an open, real-time, dated stream of every filing as it is
 * registered — which is exactly the timing signal the whole engine is built on, and the one thing
 * Norway does not have. So the stream comes first and the industry filter second, instead of the
 * Finnish order.
 *
 * Volume is the other difference: 2,283 filings in a single week against Finland's 2,848 in ten.
 * Same signal, an order of magnitude more of it.
 *
 * Three free sources, none of them needing a key:
 *   distribution.virk.dk   the publication stream, Elasticsearch, real time
 *   regnskaber.virk.dk     the filing itself as XBRL
 *   cvrapi.dk              industry, age, city and headcount for one CVR number
 */

const VIRK = 'http://distribution.virk.dk/offentliggoerelser/_search'
const CVR = 'https://cvrapi.dk/api'
const UA = 'originaatio/1.0 (+https://mergero.justusberner.com)'

export const currency = 'DKK'
export const verifyUrl = (businessId: string) => `https://datacvr.virk.dk/enhed/virksomhed/${businessId}`

/** Danish industry codes carry six digits to Finland's five; the first four are shared NACE. */
const nace4 = (code: string) => code.replace(/\D/g, '').slice(0, 4)

type Hit = {
  _source: {
    cvrNummer: number
    regnskab?: { regnskabsperiode?: { startDato: string; slutDato: string } }
    offentliggoerelsesTidspunkt: string
    dokumenter?: { dokumentUrl: string; dokumentMimeType: string }[]
  }
}

/**
 * The stream, newest first.
 *
 * Bounded deliberately: a seventy-day window holds tens of thousands of filings and every one of
 * them would cost a company lookup. The cap is reported on the lane so the number on screen is
 * never mistaken for the whole window.
 */
export async function filings(start: string, end: string, cap: number): Promise<{ total: number; rows: Filing[] }> {
  const rows: Filing[] = []
  let total = 0

  for (let from = 0; from < cap; from += 200) {
    const body = {
      size: Math.min(200, cap - from),
      from,
      sort: [{ offentliggoerelsesTidspunkt: 'desc' }],
      query: {
        bool: {
          must: [
            { range: { offentliggoerelsesTidspunkt: { gte: start, lte: end } } },
            { term: { offentliggoerelsestype: 'regnskab' } },
          ],
        },
      },
    }
    let page: { hits?: { total?: number | { value: number }; hits?: Hit[] } }
    try {
      const res = await fetch(VIRK, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) break
      page = await res.json()
    } catch {
      break
    }
    const t = page.hits?.total
    total = typeof t === 'number' ? t : (t?.value ?? total)
    const hits = page.hits?.hits ?? []
    if (!hits.length) break

    for (const h of hits) {
      const s = h._source
      const xml = s.dokumenter?.find((d) => d.dokumentMimeType === 'application/xml')?.dokumentUrl
      const end2 = s.regnskab?.regnskabsperiode?.slutDato
      if (!xml || !end2) continue
      rows.push({
        businessId: String(s.cvrNummer),
        financialDate: end2,
        // The day the filing was published, which is the signal. Denmark dates it; Norway does not.
        registrationDate: s.offentliggoerelsesTidspunkt.slice(0, 10),
        // The document address travels with the filing so the figures need no second lookup.
        documentUrl: xml,
      } as Filing & { documentUrl: string })
    }
  }
  return { total, rows }
}

type Cvr = {
  vat?: number
  name?: string
  industrycode?: number | string
  industrydesc?: string
  startdate?: string
  city?: string
  employees?: number
  companydesc?: string
}

/** `10/08 - 2001` is how the CVR service writes a date. */
const cvrDate = (s: string | undefined): string => {
  const m = /(\d{2})\/(\d{2})\s*-\s*(\d{4})/.exec(s ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/**
 * One CVR number into a company, or null if it is not one we are looking for.
 *
 * The industry and age tests happen here rather than in the pipeline because this is the only
 * place that knows them: the filing stream carries a CVR number and nothing else.
 */
export async function company(
  businessId: string,
  industries: string[],
  minAgeYears: number,
  excludeHolding: boolean,
  asOf: Date,
  exclude: RegExp,
): Promise<Company | null> {
  let d: Cvr
  try {
    const res = await fetch(`${CVR}?search=${businessId}&country=dk`, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    d = (await res.json()) as Cvr
  } catch {
    return null
  }
  if (!d.name) return null
  // Aktieselskab and Anpartsselskab are the two limited forms; everything else is not a target.
  if (!/aktieselskab|anpartsselskab/i.test(d.companydesc ?? '')) return null

  const prefix = nace4(String(d.industrycode ?? ''))
  const match = industries.find((code) => nace4(code) === prefix)
  if (!match) return null

  const registered = cvrDate(d.startdate)
  if (!registered) return null
  if (asOf.getFullYear() - Number(registered.slice(0, 4)) < minAgeYears) return null
  if (excludeHolding && exclude.test(d.name)) return null

  return {
    businessId,
    name: d.name,
    registered,
    industry: match,
    industryName: CONSOLIDATING[match] ?? d.industrydesc ?? match,
    // The CVR service does not expose former names, so absence is not evidence either way.
    renames: 0,
    postCode: null,
    city: d.city ?? null,
    website: null,
    employer: (d.employees ?? 0) > 0,
  }
}

/**
 * The figures, out of the filing's own XBRL.
 *
 * Both periods are in the document, tagged against contexts that carry their dates, so the
 * direction of travel costs no second request. Revenue is usually absent: a small Danish company
 * may use the same exemption a Finnish one does, so the balance sheet total is the size measure
 * here too, with the operating result taken when it is there.
 */
export async function financials(f: Filing & { documentUrl?: string }): Promise<Financials | null> {
  if (!f.documentUrl) return null
  let xml: string
  try {
    xml = await fetchText(f.documentUrl)
  } catch {
    return null
  }

  const dates = new Map<string, string>()
  for (const m of xml.matchAll(/<xbrli:context id="([^"]+)"([\s\S]*?)<\/xbrli:context>/g)) {
    const when = /<xbrli:endDate>([^<]+)<\/xbrli:endDate>/.exec(m[2]) ?? /<xbrli:instant>([^<]+)<\/xbrli:instant>/.exec(m[2])
    if (when) dates.set(m[1], when[1])
  }

  /** Every value for one tag, keyed by the date of the period it belongs to. */
  const byDate = (tag: string) => {
    const out = new Map<string, number>()
    const re = new RegExp(`<[a-zA-Z0-9]+:${tag}\\s[^>]*contextRef="([^"]+)"[^>]*>([-0-9.]+)<`, 'g')
    for (const m of xml.matchAll(re)) {
      const when = dates.get(m[1])
      const value = Number(m[2])
      if (when && Number.isFinite(value)) out.set(when, value)
    }
    return out
  }

  const assets = byDate('Assets')
  if (!assets.size) return null
  const ordered = [...assets.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const [, size] = ordered[0]
  const prev = ordered[1]?.[1] ?? null

  const revenue = byDate('Revenue')
  const orderedRevenue = [...revenue.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return {
    businessId: f.businessId,
    financialDate: ordered[0][0],
    registrationDate: f.registrationDate,
    balanceProxy: size,
    balanceProxyPrev: prev,
    changePct: prev && prev > 0 ? ((size - prev) / prev) * 100 : null,
    // How many of the two headline figures were actually tagged, useful for spotting thin filings.
    lineItems: (assets.size ? 1 : 0) + (orderedRevenue.length ? 1 : 0),
  }
}
