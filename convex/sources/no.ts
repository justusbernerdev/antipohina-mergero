import type { Company, Filing, Financials } from '../lib/types'
import { CONSOLIDATING, EXCLUDE_NAME } from '../lib/industries'
import { fetchJson, mapLimit } from '../lib/net'

/**
 * Norway · Brønnøysundregistrene.
 *
 * Better than Finland in three ways that matter, all free and without a key:
 *
 *   1. Accounts come back as parsed JSON with revenue and operating profit, not just a balance
 *      sheet total. Mergero's own criterion is stated on earnings, which here is testable directly
 *      rather than approximated.
 *   2. Headcount is in the register record. Finland does not publish it.
 *   3. `erIKonsern` says whether the company already sits inside a group — that is, whether it has
 *      already been bought. In Finland that has to be inferred from the name.
 *
 * There is no dated filing stream, so the timing signal comes from the register record itself:
 * `sisteInnsendteAarsregnskap` is the most recent year filed.
 */

const ENHET = 'https://data.brreg.no/enhetsregisteret/api'
const REGNSKAP = 'https://data.brreg.no/regnskapsregisteret/regnskap'

export const currency = 'NOK'
export const verifyUrl = (businessId: string) => `https://virksomhet.brreg.no/nb/oppslag/enheter/${businessId}`

/**
 * The two countries agree on four digits and disagree on the fifth.
 *
 * Finnish TOL and Norwegian SN2007 are both national extensions of NACE, so 43.22 means plumbing in
 * both — but Finland's fifth digit is 43220 and Norway's is 43.221. Querying the Finnish code
 * verbatim returns nothing, silently, which is the worst way for a filter to be wrong. Brønnøysund
 * accepts the four-digit prefix and answers with every sub-code under it, so that is what we ask for.
 */
const toNace = (code: string) => `${code.slice(0, 2)}.${code.slice(2, 4)}`

/** Two Finnish codes can share a NACE prefix; fetch each prefix once and label it with the first. */
function byPrefix(industries: string[]): [string, string][] {
  const seen = new Map<string, string>()
  for (const code of industries) {
    const prefix = toNace(code)
    if (!seen.has(prefix)) seen.set(prefix, code)
  }
  return [...seen.entries()]
}

/**
 * Norwegian name markers. The `-sen`/`-son` patronymics are the strongest, as `-nen` is in Finnish.
 * Place-name endings appear in company names too but are weaker, so they need length.
 */
const SURNAME_ENDINGS = ['sen', 'son', 'stad', 'vik', 'berg', 'dal', 'haug', 'lund', 'rud', 'nes']
const FIRST_NAMES = new Set(
  `jan per bjørn bjorn ole kjell arne lars knut svein odd tor geir terje rolf hans erik nils olav
   morten thomas anders andreas christian magnus henrik jonas martin sindre einar rune trond stein
   anne inger kari marit ingrid liv berit astrid solveig randi bjørg hanne nina marianne kristin
   silje ida maria emma nora`.split(/\s+/),
)
const COMMON_WORDS = new Set(
  `norsk norske nord sør sor øst ost vest renhold service gruppen group transport bygg anlegg
   eiendom drift teknikk maskin as asa holding invest`.split(/\s+/),
)

type Entity = {
  organisasjonsnummer: string
  navn: string
  registreringsdatoEnhetsregisteret?: string
  stiftelsesdato?: string
  antallAnsatte?: number
  erIKonsern?: boolean
  konkurs?: boolean
  underAvvikling?: boolean
  underTvangsavviklingEllerTvangsopplosning?: boolean
  sisteInnsendteAarsregnskap?: string
  historiskeNavn?: unknown[]
  naeringskode1?: { kode: string; beskrivelse: string }
  forretningsadresse?: { postnummer?: string; poststed?: string }
}

type Page = { _embedded?: { enheter?: Entity[] }; page?: { totalElements: number; totalPages: number } }

export async function companies(
  industries: string[],
  minAgeYears: number,
  excludeHolding: boolean,
  asOf: Date,
): Promise<{ universe: number; rows: Company[]; lastFiled: Map<string, string> }> {
  const cutoff = `${asOf.getFullYear() - minAgeYears}-12-31`
  let universe = 0
  const rows: Company[] = []
  const lastFiled = new Map<string, string>()

  for (const [prefix, industry] of byPrefix(industries)) {
    const base =
      `${ENHET}/enheter?naeringskode=${prefix}&organisasjonsform=AS` +
      `&tilRegistreringsdatoEnhetsregisteret=${cutoff}&size=100`
    let first: Page
    try {
      first = await fetchJson<Page>(`${base}&page=0`)
    } catch {
      continue
    }
    const total = first.page?.totalElements ?? 0
    universe += total
    const totalPages = Math.min(first.page?.totalPages ?? 1, 100)

    const batches: Entity[][] = [first._embedded?.enheter ?? []]
    if (totalPages > 1) {
      const rest = await mapLimit(
        Array.from({ length: totalPages - 1 }, (_, k) => k + 1),
        6,
        async (page) => {
          try {
            return (await fetchJson<Page>(`${base}&page=${page}`))._embedded?.enheter ?? []
          } catch {
            return []
          }
        },
      )
      batches.push(...rest)
    }

    for (const batch of batches) {
      for (const e of batch) {
        // Bankrupt or winding up: not a succession conversation.
        if (e.konkurs || e.underAvvikling || e.underTvangsavviklingEllerTvangsopplosning) continue
        // Already inside a group means already bought. This is the filter Finland cannot do.
        if (e.erIKonsern) continue
        if (excludeHolding && EXCLUDE_NAME.test(e.navn)) continue

        const registered = e.registreringsdatoEnhetsregisteret ?? e.stiftelsesdato
        if (!registered) continue

        if (e.sisteInnsendteAarsregnskap) lastFiled.set(e.organisasjonsnummer, e.sisteInnsendteAarsregnskap)

        rows.push({
          businessId: e.organisasjonsnummer,
          name: e.navn,
          registered,
          industry,
          industryName: CONSOLIDATING[industry] ?? e.naeringskode1?.beskrivelse ?? industry,
          renames: Math.max(0, e.historiskeNavn?.length ?? 0),
          postCode: e.forretningsadresse?.postnummer ?? null,
          city: e.forretningsadresse?.poststed ?? null,
          website: null,
          // Headcount stands in for the employer register: real payroll, real business.
          employer: (e.antallAnsatte ?? 0) > 0,
        })
      }
    }
  }

  return { universe, rows, lastFiled }
}

type Accounts = {
  regnskapsperiode?: { fraDato: string; tilDato: string }
  resultatregnskapResultat?: {
    driftsresultat?: { driftsinntekter?: { sumDriftsinntekter?: number }; driftsresultat?: number }
  }
  eiendeler?: { sumEiendeler?: number }
}

/** Two periods come back in one response, so the direction of travel costs no extra request. */
export async function financials(f: Filing): Promise<Financials | null> {
  let rows: Accounts[]
  try {
    rows = await fetchJson<Accounts[]>(`${REGNSKAP}/${f.businessId}`)
  } catch {
    return null
  }
  const list = Array.isArray(rows) ? rows : [rows]
  const r = list[0]
  if (!r?.regnskapsperiode) return null

  const sizeOf = (a: Accounts | undefined) => {
    if (!a) return null
    const revenue = a.resultatregnskapResultat?.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null
    return revenue ?? a.eiendeler?.sumEiendeler ?? null
  }

  // Revenue is the better size measure and it is available, so prefer it over the balance sheet.
  const size = sizeOf(r)
  if (size === null) return null
  const prev = sizeOf(list[1])

  return {
    businessId: f.businessId,
    financialDate: r.regnskapsperiode.tilDato,
    registrationDate: f.registrationDate || r.regnskapsperiode.tilDato,
    balanceProxy: size,
    balanceProxyPrev: prev,
    changePct: prev && prev > 0 ? ((size - prev) / prev) * 100 : null,
    lineItems: list.length,
  }
}

export function hasPersonName(name: string): boolean {
  if (name.includes('&')) return true
  const words = name
    .replace(/\b(as|asa|ans|da)\b/gi, ' ')
    .split(/[\s,.]+/)
    .filter(Boolean)
  for (const raw of words) {
    const w = raw.toLowerCase()
    if (COMMON_WORDS.has(w)) continue
    if (FIRST_NAMES.has(w)) return true
    if (w.length >= 6 && SURNAME_ENDINGS.some((e) => w.endsWith(e))) return true
  }
  return false
}
