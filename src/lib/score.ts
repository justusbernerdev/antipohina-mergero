import type { Company, Financials, ScoreReason } from './types.js'
import { CONSOLIDATING } from './industries.js'
import { consolidationPoints, consolidationReason, type IndustryHeat } from './consolidation.js'

/**
 * Succession scoring.
 *
 * The question is not "which company fits the criteria" — screening answers that, and MGX already
 * screens registers. The question is "which owner is close to a decision right now", and that is a
 * timing question. Every input below is free, public and dated, which is what makes the timing part
 * possible at all.
 *
 * What public data cannot tell us is who the owner is or how old they are. That is bought data, and
 * it is exactly the piece Mergero already has — so the engine plugs into them rather than competing.
 */

/** Common Finnish surname endings. `-nen` alone is close to decisive at six characters or more. */
const SURNAME_ENDINGS = [
  'nen', 'mäki', 'maki', 'koski', 'salo', 'niemi', 'järvi', 'jarvi', 'ranta', 'lahti',
  'aho', 'vaara', 'kangas', 'harju', 'saari', 'virta', 'oja', 'kivi', 'linna', 'pelto', 'kallio',
]

/** First names frequent enough among owners of companies founded in the 1970s to 1990s. */
const FIRST_NAMES = new Set(
  `matti timo juha kari antti pekka jari mikko markku jukka heikki seppo hannu esa ari marko sami
   janne mika ville jani tero petri harri olli lauri jorma raimo reijo veikko erkki eero risto kimmo
   kalevi juhani rauno toivo urho veli sakari tapio jaakko pertti keijo teuvo vesa arto martti kauko
   anne leena maria pirjo sari johanna päivi tarja minna tuula riitta marja liisa kirsi satu hanna
   eeva helena katja mari heidi jaana merja ritva anja seija aino elina`.split(/\s+/),
)

/** Words that look like surnames but are industry nouns. Without this every "Rakennus Oy" scores. */
const COMMON_WORDS = new Set(
  `suomen uuden pohjan idän lännen etelä pohjois itä länsi keski rakennus asennus palvelu palvelut
   huolto kuljetus urakointi konepaja teollisuus yhtiöt yhtiot group oy ab finland nordic tuote
   tekniikka työ tyo liike keskus paja korjaamo myynti kauppa`.split(/\s+/),
)

/**
 * Is a person's name embedded in the company name?
 *
 * "Kuljetusliike Jorma Saari Oy", "Metallityö H. Turunen Oy", "Reijon Diesel Oy". A company still
 * carrying its founder's name after thirty years is usually still owned by that family, which is
 * the population where succession bites. Free proxy for a fact that otherwise costs money.
 */
export function hasPersonName(name: string): boolean {
  if (name.includes('&')) return true
  const words = name
    .replace(/\b(oy|ab|ltd|oyj|ky|tmi)\b/gi, ' ')
    .split(/[\s,.]+/)
    .filter(Boolean)
  for (const raw of words) {
    const w = raw.toLowerCase()
    if (COMMON_WORDS.has(w)) continue
    if (FIRST_NAMES.has(w)) return true
    if (w.length >= 6 && SURNAME_ENDINGS.some((e) => w.endsWith(e))) return true
    // Genitive form: "Reijon", "Virtasen", "Hernesniemen". Skip -inen, which is a nominative surname.
    if (w.length >= 5 && w.endsWith('n') && !w.endsWith('inen') && /[aeiouyäö]/.test(w.slice(-3, -1))) {
      return true
    }
  }
  return false
}

export function ageOf(company: Company, asOf = new Date()): number {
  return asOf.getFullYear() - Number(company.registered.slice(0, 4))
}

/** Statutory deadline for registering a financial statement: eight months from period end. */
const DEADLINE_DAYS = 243

/** Days from the end of the financial period to the day the filing was registered. */
export function filingLagDays(f: Financials): number {
  const end = Date.parse(f.financialDate)
  const registered = Date.parse(f.registrationDate)
  if (Number.isNaN(end) || Number.isNaN(registered)) return 0
  return Math.round((registered - end) / 86_400_000)
}

export type Scored = { score: number; reasons: ScoreReason[]; age: number; ownerNamed: boolean }

/**
 * Score one company. `financials` present means the company filed recently, which is the timing
 * signal — the owner has just seen their own numbers, possibly for the last time before deciding.
 */
export function score(
  company: Company,
  financials: Financials | null,
  heat?: IndustryHeat,
  asOf = new Date(),
): Scored {
  const reasons: ScoreReason[] = []
  const add = (label: string, points: number) => reasons.push({ label, points })

  const age = ageOf(company, asOf)
  if (age >= 25) add(`${age} vuotta vanha`, 3)
  else if (age >= 15) add(`${age} vuotta vanha`, 2)

  const industry = CONSOLIDATING[company.industry]
  if (industry) add(`Konsolidoituva toimiala: ${industry}`, 2)

  // Someone is actively rolling up this industry. Context, not evidence about this owner, so capped.
  const heatPoints = consolidationPoints(heat)
  if (heatPoints) {
    const reason = consolidationReason(heat, company)
    if (reason) add(reason, heatPoints)
  }

  if (financials) {
    add('Tilinpäätös rekisteröity juuri', 3)
    // A turn in the trend is the moment an owner reconsiders. Direction matters, size of move less so.
    if (financials.changePct !== null && financials.changePct <= -10) {
      add(`Tase supistui ${Math.round(financials.changePct)} %`, 2)
    } else if (financials.changePct !== null && financials.changePct >= 20) {
      add(`Tase kasvoi ${Math.round(financials.changePct)} %`, 1)
    }

    /**
     * Filing late is a stronger signal than filing at all.
     *
     * Every company files every year, so the filing itself marks a moment, not a situation. The
     * statutory deadline is eight months from the end of the financial period, and in the measured
     * window 12% of filings crossed it. A company that misses it has something going on: an owner
     * whose attention is elsewhere, an accountant mid-change, a year nobody wanted to close.
     *
     * Worth more than the on-time filing it rides on, and free from the same document.
     */
    const lateDays = filingLagDays(financials) - DEADLINE_DAYS
    if (lateDays > 150) add(`Tilinpäätös ${Math.floor(lateDays / 30)} kk yli määräajan`, 4)
    else if (lateDays > 30) add(`Tilinpäätös ${Math.floor(lateDays / 30)} kk yli määräajan`, 3)
    else if (lateDays > 0) add(`Tilinpäätös ${lateDays} pv yli määräajan`, 2)
  }

  const ownerNamed = hasPersonName(company.name)
  if (ownerNamed) add('Henkilönimi yhtiön nimessä', 2)
  if (company.renames === 0) add('Ei koskaan nimenmuutosta', 1)
  if (company.employer) add('Työnantajarekisterissä', 2)
  if (company.city && !['HELSINKI', 'ESPOO', 'VANTAA'].includes(company.city)) {
    add('Pääkaupunkiseudun ulkopuolella', 1)
  }

  return { score: reasons.reduce((s, r) => s + r.points, 0), reasons, age, ownerNamed }
}
