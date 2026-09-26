/**
 * Norway scan.
 *
 * Proof that the engine is not Finland-specific. Same scoring, same buyer matching, different
 * source — and in Norway the size test is real rather than approximated, because revenue comes back
 * in the accounts.
 *
 * Usage:  npm run scan:no -- --min-revenue 20000000 --limit 40
 */

import { writeFile } from 'node:fs/promises'
import { norway } from '../src/sources/no.js'
import { CONSOLIDATING, EXCLUDE_NAME } from '../src/lib/industries.js'
import { score } from '../src/lib/score.js'
import { sleep } from '../src/lib/prh.js'
import type { Company, Financials, Target } from '../src/lib/types.js'

const args = process.argv.slice(2)
const arg = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}

/** NOK. Roughly 1.7M EUR, the bottom of Mergero's €2-100M enterprise value band at a 1x multiple. */
const MIN_REVENUE = Number(arg('min-revenue', '20000000'))
const LIMIT = Number(arg('limit', '40'))
const MIN_AGE = Number(arg('min-age', '15'))

/** A slice wide enough to be a real test, narrow enough to run in minutes. */
const INDUSTRIES = new Set(['81210', '49410', '43220', '43210', '43120'])

console.log(`Norja: ${INDUSTRIES.size} toimialaa, vähintään ${MIN_AGE} v vanhat osakeyhtiöt\n`)

const companies: Company[] = []
for await (const c of norway.companies({ minAge: MIN_AGE, industries: INDUSTRIES, exclude: EXCLUDE_NAME })) {
  companies.push(c)
  if (companies.length % 100 === 0) console.log(`  ${companies.length} yhtiötä`)
}
console.log(`\nKohdeyhtiöitä: ${companies.length}`)
console.log('Haetaan tilinpäätökset...\n')

const scored: Target[] = []
let fetched = 0
let withRevenue = 0

for (const c of companies) {
  const f = await norway.financials({
    businessId: c.businessId,
    financialDate: '',
    registrationDate: '',
  })
  fetched++
  if (f) {
    if (f.lineItems >= 2) withRevenue++
    if (f.balanceProxy >= MIN_REVENUE) {
      const s = score(c, f)
      scored.push({ company: c, financials: f, ...s, matches: [] })
    }
  }
  if (fetched % 50 === 0) console.log(`  ${fetched}/${companies.length}, ${scored.length} yli rajan`)
  await sleep(120)
}

scored.sort((a, b) => b.score - a.score || b.financials.balanceProxy - a.financials.balanceProxy)
const targets = scored.slice(0, LIMIT)
await writeFile('data/targets-no.json', JSON.stringify(targets, null, 2))

console.log(`\nSuppilo`)
console.log(`  ${String(companies.length).padStart(6)}  kohdeyhtiötä toimialoilla`)
console.log(`  ${String(fetched).padStart(6)}  tilinpäätös haettu`)
console.log(`  ${String(withRevenue).padStart(6)}  liikevaihto saatavilla`)
console.log(`  ${String(scored.length).padStart(6)}  liikevaihto yli ${(MIN_REVENUE / 1e6).toFixed(0)} M NOK\n`)

for (const t of targets.slice(0, 15)) {
  const m = (t.financials.balanceProxy / 1e6).toFixed(1)
  console.log(
    `  ${String(t.score).padStart(2)}p  ${m.padStart(6)} M NOK  ${t.company.name.slice(0, 34).padEnd(34)}  ${t.company.city ?? ''}`,
  )
}
console.log(`\nKirjoitettu data/targets-no.json`)
