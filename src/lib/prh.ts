/**
 * Finnish Trade Register (PRH) open data clients.
 *
 * Three endpoints carry the whole pipeline:
 *   all_companies            the entire register as one zipped JSON file, refreshed daily
 *   all_financial_statements every digital filing registered in a date range (the stream)
 *   financial                one filing as raw XBRL, previous period included
 *
 * No API key, no rate plan. The register download is the only heavy call.
 */

export const YTJ = 'https://avoindata.prh.fi/opendata-ytj-api/v3'
export const XBRL = 'https://avoindata.prh.fi/opendata-xbrl-api/v3'

/**
 * The register is a public service with a shared quota and it drops connections under load.
 * Retry on 429 and on transport errors alike; the default 10 s connect timeout is too short for it.
 */
async function withRetry(url: string, attempts: number, accept?: string): Promise<Response> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: accept ? { accept } : undefined,
        signal: AbortSignal.timeout(60_000),
      })
      if (res.ok) return res
      if (res.status === 429) {
        await sleep(3000 + i * 4000)
        continue
      }
      last = new Error(`${res.status} ${url}`)
    } catch (err) {
      last = err
    }
    await sleep(2000 + i * 2000)
  }
  throw last ?? new Error(`exhausted ${url}`)
}

export async function fetchJson<T>(url: string, attempts = 5): Promise<T> {
  const res = await withRetry(url, attempts, 'application/json')
  return (await res.json()) as T
}

export async function fetchText(url: string, attempts = 4): Promise<string> {
  const res = await withRetry(url, attempts)
  return await res.text()
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One filing in the stream. This is the timing signal: the owner just looked at their own numbers. */
export type Filing = {
  businessId: string
  /** End date of the financial period, needed to fetch the filing itself. */
  financialDate: string
  registrationDate: string
}

/**
 * Every digital financial statement registered between two dates.
 * Paged at 100; the endpoint reports the total so we can stop exactly.
 */
export async function filingsBetween(start: string, end: string): Promise<Filing[]> {
  const out: Filing[] = []
  for (let page = 1; ; page++) {
    const d = await fetchJson<{ totalResults: number; financials: Filing[] }>(
      `${XBRL}/all_financial_statements?registeredDateStart=${start}&registeredDateEnd=${end}&page=${page}`,
    )
    if (!d.financials?.length) break
    out.push(...d.financials)
    if (out.length >= d.totalResults) break
    await sleep(400)
  }
  return out
}

/** Raw XBRL for one filing. Finnish small-company taxonomy, comparative period in the same document. */
export function filingUrl(businessId: string, financialDate: string) {
  return `${XBRL}/financial?businessId=${businessId}&financialDate=${financialDate}`
}

/** Daily snapshot of the whole register, about 97 MB zipped and 1.5 GB open. */
export const REGISTER_URL = `${YTJ}/all_companies`
