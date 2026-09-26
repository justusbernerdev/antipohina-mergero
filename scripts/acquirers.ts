/**
 * Build the buyer book from the register itself.
 *
 * A serial acquirer leaves a public trail: every company it buys and merges shows up as an
 * auxiliary trade name with a registration date. Two or more auxiliary names registered in
 * different years is the signature.
 *
 * This runs over the same register zip `ingest` already downloaded, so it costs one pass over local
 * disk and no network at all.
 *
 * Usage:  npm run acquirers
 */

import { createWriteStream, existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { CONSOLIDATING } from '../src/lib/industries.js'
import { industryHeat, isActive, type Acquirer } from '../src/lib/consolidation.js'

const ZIP = 'data/raw/all_companies.zip'
if (!existsSync(ZIP)) {
  console.error('Aja ensin npm run ingest, joka lataa rekisterin.')
  process.exit(1)
}

const acquirers: Acquirer[] = []
let seen = 0

const unzip = spawn('unzip', ['-p', ZIP], { stdio: ['ignore', 'pipe', 'inherit'] })
let buf = ''
let depth = 0
let inString = false
let escaped = false
let started = false

for await (const chunk of unzip.stdout.setEncoding('utf8')) {
  for (const ch of chunk as string) {
    if (!started) {
      if (ch === '{') {
        started = true
        depth = 1
        buf = '{'
      }
      continue
    }
    buf += ch
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth > 0) continue
      started = false
      seen++
      const a = readAcquirer(buf)
      if (a) acquirers.push(a)
      if (seen % 150_000 === 0) console.log(`  ${seen} luettu, ${acquirers.length} löytynyt`)
    }
  }
}

function readAcquirer(raw: string): Acquirer | null {
  let c: any
  try {
    c = JSON.parse(raw)
  } catch {
    return null
  }
  const forms: string[] = (c.companyForms ?? []).filter((f: any) => !f.endDate).map((f: any) => f.type)
  if (!forms.includes('16') || c.status !== '2') return null

  // Type 3 is an auxiliary trade name. Still in force, i.e. the brand is being kept alive.
  const aux = (c.names ?? []).filter((n: any) => n.type === '3' && !n.endDate && n.registrationDate)
  if (aux.length < 2) return null

  // Two names registered on the same day are usually one filing, not two acquisitions.
  const years = new Set(aux.map((n: any) => String(n.registrationDate).slice(0, 4)))
  if (years.size < 2) return null

  const main = (c.names ?? []).find((n: any) => n.type === '1' && !n.endDate)
  return {
    businessId: c.businessId.value,
    name: main?.name ?? '',
    industry: c.mainBusinessLine?.type ?? '',
    registered: c.registrationDate ?? '',
    acquisitions: aux
      .map((n: any) => ({ name: n.name, date: n.registrationDate }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date)),
  }
}

const relevant = acquirers.filter((a) => a.industry in CONSOLIDATING)
const active = relevant.filter(isActive)
const heat = industryHeat(active)

await writeFile('data/acquirers.json', JSON.stringify(active, null, 1))
await writeFile('data/heat.json', JSON.stringify([...heat.values()], null, 1))

console.log(`\n${seen} yksikköä läpi`)
console.log(`${acquirers.length} yhtiötä joilla on useita aputoiminimiä eri vuosilta`)
console.log(`${relevant.length} konsolidoituvilla toimialoilla`)
console.log(`${active.length} aktiivista, eli ostanut vuonna 2023 tai myöhemmin\n`)

const top = [...active].sort((a, b) => b.acquisitions.length - a.acquisitions.length).slice(0, 15)
for (const a of top) {
  const years = a.acquisitions.map((x) => x.date.slice(0, 4))
  console.log(
    `  ${String(a.acquisitions.length).padStart(3)} ostoa  ${a.industry}  ${a.name.slice(0, 34).padEnd(34)}  ${years[0]} to ${years.at(-1)}`,
  )
}

console.log('\nKuumimmat toimialat')
for (const h of [...heat.values()].sort((a, b) => b.consolidators - a.consolidators).slice(0, 10)) {
  console.log(
    `  ${h.industry}  ${CONSOLIDATING[h.industry].padEnd(28)} ${String(h.consolidators).padStart(3)} ostajaa, ${h.recentDeals} kauppaa 2023 jälkeen`,
  )
}
