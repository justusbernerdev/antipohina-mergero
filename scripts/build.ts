/**
 * Stage 2: turn raw public data into a call list.
 *
 * Reads data/raw/, scores every company that filed recently, matches it against the buyer book and
 * writes data/targets.json plus data/funnel.json. Pure computation, no network, so it re-runs in a
 * second while the scoring is being tuned.
 *
 * Usage:  npm run build:targets -- --min-size 1500000 --limit 200
 */

import { open, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { score } from '../src/lib/score.js'
import { matchBuyers } from '../src/lib/buyers.js'
import type { Company, Financials, Target } from '../src/lib/types.js'

const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

/** Below this the company is too small for Mergero's €2-100M enterprise value band. */
const MIN_SIZE = Number(arg('min-size', '1500000'))
const LIMIT = Number(arg('limit', '200'))

async function readJsonl<T>(path: string): Promise<T[]> {
  const out: T[] = []
  const rl = createInterface({ input: (await open(path)).createReadStream() })
  for await (const line of rl) if (line.trim()) out.push(JSON.parse(line))
  return out
}

const companies = await readJsonl<Company>('data/raw/companies.jsonl')
const financials = await readJsonl<Financials>('data/raw/financials.jsonl')
const byId = new Map(companies.map((c) => [c.businessId, c]))

const funnel: { stage: string; left: number; note: string }[] = [
  { stage: 'Konsolidoituvalla toimialalla, vähintään 15 v vanha', left: companies.length, note: 'Kaupparekisteri, paikallinen suodatus' },
  { stage: 'Tilinpäätös rekisteröity ikkunassa', left: financials.length, note: 'Digitaalinen tilinpäätösvirta' },
]

const scored: Target[] = []
for (const f of financials) {
  const company = byId.get(f.businessId)
  if (!company) continue
  const s = score(company, f)
  scored.push({ company, financials: f, ...s, matches: matchBuyers(company, f) })
}

const sized = scored.filter((t) => t.financials.balanceProxy >= MIN_SIZE)
funnel.push({
  stage: `Tase vähintään ${(MIN_SIZE / 1e6).toFixed(1)} M€`,
  left: sized.length,
  note: 'Kokoluokkarajaus, taseen loppusumma proxyna',
})

const matched = sized.filter((t) => t.matches.length > 0)
funnel.push({
  stage: 'Vähintään yksi ostaja täyttää kriteerit',
  left: matched.length,
  note: 'Ostajakirja, julkisista kaupoista koottu',
})

// Highest signal first, then size. Size breaks ties because a bigger company is a bigger mandate.
matched.sort((a, b) => b.score - a.score || b.financials.balanceProxy - a.financials.balanceProxy)

const targets = matched.slice(0, LIMIT)
await writeFile('data/targets.json', JSON.stringify(targets, null, 2))
await writeFile(
  'data/funnel.json',
  JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), minSize: MIN_SIZE, funnel }, null, 2),
)

console.log('\nSuppilo')
for (const f of funnel) console.log(`  ${String(f.left).padStart(8)}  ${f.stage}`)
console.log(`\nKirjoitettu data/targets.json (${targets.length} kohdetta)\n`)

for (const t of targets.slice(0, 15)) {
  const size = (t.financials.balanceProxy / 1e6).toFixed(1)
  const buyers = t.matches.map((m) => m.buyer.name).join(', ')
  console.log(
    `  ${String(t.score).padStart(2)}p  ${size.padStart(5)} M€  ${t.company.name.slice(0, 32).padEnd(32)}  ${buyers}`,
  )
}
