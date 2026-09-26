import type { RegisterSource, SourceOptions } from './types.js'
import type { Company, Filing, Financials } from '../lib/types.js'
import { fetchJson, sleep } from '../lib/prh.js'

/**
 * Norway · Brønnøysundregistrene.
 *
 * Better than Finland in three ways that matter, all free and without a key:
 *
 *   1. Accounts come back as parsed JSON with REVENUE and OPERATING PROFIT, not just a balance
 *      sheet total. Mergero's own criterion is EBITDA above $1M, which here is testable directly
 *      rather than approximated.
 *   2. Headcount is in the register record. Finland does not publish it.
 *   3. `erIKonsern` says whether the company already sits inside a group — that is, whether it has
 *      already been bought. In Finland that has to be inferred.
 *
 * Filtering happens server-side, so the whole register never has to be downloaded.
 */

const ENHET = 'https://data.brreg.no/enhetsregisteret/api'
const REGNSKAP = 'https://data.brreg.no/regnskapsregisteret/regnskap'

/** NACE codes are dotted here: 81210 in Finland is 81.210 in Norway. */
const toNace = (code: string) => `${code.slice(0, 2)}.${code.slice(2)}`

/**
 * Norwegian surname markers. The `-sen`/`-son` patronymics are the strongest, as `-nen` is in
 * Finnish. Place-name endings appear in company names too but are weaker, so they need length.
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

export const norway: RegisterSource = {
  code: 'NO',
  name: 'Norja',
  currency: 'NOK',

  async *companies(opts: SourceOptions) {
    const asOf = opts.asOf ?? new Date()
    const latestFounding = `${asOf.getFullYear() - opts.minAge}-12-31`

    for (const industry of opts.industries) {
      for (let page = 0; ; page++) {
        const url =
          `${ENHET}/enheter?naeringskode=${toNace(industry)}&organisasjonsform=AS` +
          `&tilRegistreringsdatoEnhetsregisteret=${latestFounding}&size=100&page=${page}`
        const d = await fetchJson<NorwegianPage>(url)
        const rows = d._embedded?.enheter ?? []
        if (!rows.length) break

        for (const e of rows) {
          // Bankrupt or winding up: not a succession conversation.
          if (e.konkurs || e.underAvvikling || e.underTvangsavviklingEllerTvangsopplosning) continue
          // Already inside a group means already bought. This is the filter Finland cannot do.
          if (e.erIKonsern) continue
          if (opts.exclude.test(e.navn)) continue

          const registered = e.registreringsdatoEnhetsregisteret ?? e.stiftelsesdato
          if (!registered) continue

          yield {
            businessId: e.organisasjonsnummer,
            name: e.navn,
            registered,
            industry,
            industryName: e.naeringskode1?.beskrivelse ?? industry,
            // Norway exposes previous names separately; absence of the field means no rename.
            renames: Math.max(0, (e.historiskeNavn?.length ?? 0)),
            postCode: e.forretningsadresse?.postnummer ?? null,
            city: e.forretningsadresse?.poststed ?? null,
            website: null,
            // Headcount stands in for the employer register: real payroll, real business.
            employer: (e.antallAnsatte ?? 0) > 0,
          } satisfies Company
        }

        if (page + 1 >= (d.page?.totalPages ?? 1)) break
        await sleep(250)
      }
    }
  },

  /**
   * Norway publishes no dated filing stream, so the timing signal comes from the register record
   * itself: `sisteInnsendteAarsregnskap` is the most recent year filed. A company whose latest
   * filing is two years old is late in the same sense a late Finnish filing is late.
   */
  async filings() {
    return []
  },

  async financials(filing: Filing): Promise<Financials | null> {
    let rows: NorwegianAccounts[]
    try {
      rows = await fetchJson<NorwegianAccounts[]>(`${REGNSKAP}/${filing.businessId}`)
    } catch {
      return null
    }
    const r = Array.isArray(rows) ? rows[0] : rows
    if (!r?.regnskapsperiode) return null

    const operating = r.resultatregnskapResultat?.driftsresultat
    const revenue = operating?.driftsinntekter?.sumDriftsinntekter ?? null
    const assets = r.eiendeler?.sumEiendeler ?? null

    // Revenue is the better size measure and it is available, so prefer it over the balance sheet.
    const size = revenue ?? assets
    if (size === null) return null

    return {
      businessId: filing.businessId,
      financialDate: r.regnskapsperiode.tilDato,
      registrationDate: filing.registrationDate || r.regnskapsperiode.tilDato,
      balanceProxy: size,
      balanceProxyPrev: null,
      changePct: null,
      lineItems: revenue !== null ? 2 : 1,
    }
  },

  hasPersonName(name: string): boolean {
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
  },

  verifyUrl: (businessId) => `https://virksomhet.brreg.no/nb/oppslag/enheter/${businessId}`,
}

/* ------------------------------------------------------------------ API shapes */

type NorwegianPage = {
  _embedded?: { enheter?: NorwegianEntity[] }
  page?: { totalElements: number; totalPages: number }
}

type NorwegianEntity = {
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

type NorwegianAccounts = {
  regnskapsperiode?: { fraDato: string; tilDato: string }
  resultatregnskapResultat?: {
    driftsresultat?: {
      driftsinntekter?: { sumDriftsinntekter?: number }
      driftsresultat?: number
    }
  }
  eiendeler?: { sumEiendeler?: number }
}
