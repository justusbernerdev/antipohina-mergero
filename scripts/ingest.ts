/**
 * Stage 1: pull public data down to disk.
 *
 *   register   the whole Finnish trade register, filtered to active limited companies
 *   filings    every digital financial statement registered in the window (the timing stream)
 *   financials the XBRL behind each filing that survived the register filter
 *
 * Everything lands in data/raw/ as JSONL so later stages are re-runnable without touching PRH again.
 * Usage:  npm run ingest -- --from 2026-06-01 --to 2026-09-26
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { open, readFile, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { spawn } from 'node:child_process'
import { filingsBetween, filingUrl, fetchText, sleep, REGISTER_URL } from '../src/lib/prh.js'
import { parseFiling } from '../src/lib/xbrl.js'
import { EXCLUDE_NAME, CONSOLIDATING } from '../src/lib/industries.js'
import type { Company, Filing } from '../src/lib/types.js'

const RAW = 'data/raw'
const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const FROM = arg('from', '2026-06-01')
const TO = arg('to', new Date().toISOString().slice(0, 10))
/** Companies younger than this are not in a succession situation yet. */
const MIN_AGE = Number(arg('min-age', '15'))

mkdirSync(RAW, { recursive: true })

/* ------------------------------------------------------------------ register */

/**
 * The register ships as a single ~97 MB zip holding a 1.5 GB JSON array. Streaming it through
 * `unzip -p` and splitting on brace depth keeps memory flat and avoids a JSON dependency.
 */
async function ingestRegister(): Promise<number> {
  const zipPath = `${RAW}/all_companies.zip`
  const outPath = `${RAW}/companies.jsonl`

  if (!existsSync(zipPath)) {
    console.log('Ladataan kaupparekisteri...')
    const res = await fetch(REGISTER_URL)
    if (!res.ok || !res.body) throw new Error(`register download failed: ${res.status}`)
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(zipPath))
  }
  console.log(`Rekisteri: ${(statSync(zipPath).size / 1e6).toFixed(1)} MB`)

  const out = createWriteStream(outPath)
  const unzip = spawn('unzip', ['-p', zipPath], { stdio: ['ignore', 'pipe', 'inherit'] })

  let buf = ''
  let depth = 0
  let inString = false
  let escaped = false
  let started = false
  let seen = 0
  let kept = 0

  const thisYear = new Date().getFullYear()

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
        const company = reduce(buf, thisYear)
        if (company) {
          out.write(JSON.stringify(company) + '\n')
          kept++
        }
        if (seen % 100_000 === 0) console.log(`  ${seen} luettu, ${kept} poimittu`)
      }
    }
  }
  await new Promise((r) => out.end(r))
  console.log(`Rekisteri valmis: ${seen} yksikköä, ${kept} kohdetta jäljellä`)
  return kept
}

/** Reduce one raw register record to a Company, or drop it. Filtering here keeps data/ small. */
function reduce(raw: string, thisYear: number): Company | null {
  let c: any
  try {
    c = JSON.parse(raw)
  } catch {
    return null
  }

  // Active limited company in the trade register. Everything else is noise for this purpose.
  const forms: string[] = (c.companyForms ?? []).filter((f: any) => !f.endDate).map((f: any) => f.type)
  if (!forms.includes('16') || c.tradeRegisterStatus !== '1' || c.status !== '2') return null
  if (!c.registrationDate) return null
  if (thisYear - Number(String(c.registrationDate).slice(0, 4)) < MIN_AGE) return null

  const industry = c.mainBusinessLine?.type
  if (!industry || !(industry in CONSOLIDATING)) return null

  const names = (c.names ?? []).filter((n: any) => n.type === '1')
  const current = names.find((n: any) => !n.endDate) ?? names[0]
  const name: string = current?.name ?? ''
  if (!name || EXCLUDE_NAME.test(name)) return null

  const address = (c.addresses ?? [])[0] ?? {}
  const city =
    (address.postOffices ?? []).find((p: any) => p.languageCode === '1')?.city ?? null

  return {
    businessId: c.businessId.value,
    name,
    registered: c.registrationDate,
    industry,
    industryName: CONSOLIDATING[industry],
    renames: Math.max(0, names.length - 1),
    postCode: address.postCode ?? null,
    city,
    website: c.website?.url ?? null,
    // Register 3 is the employer register. An open entry means the company runs payroll today.
    employer: (c.registeredEntries ?? []).some((e: any) => e.register === '3' && !e.endDate),
  }
}

/* ------------------------------------------------------------------- filings */

async function ingestFilings(): Promise<Filing[]> {
  console.log(`Haetaan tilinpäätösvirta ${FROM} to ${TO}...`)
  const filings = await filingsBetween(FROM, TO)
  await writeFile(`${RAW}/filings.json`, JSON.stringify(filings))
  console.log(`Virrassa ${filings.length} tilinpäätöstä`)
  return filings
}

/* ---------------------------------------------------------------- financials */

/**
 * Fetch the XBRL only for companies that passed the register filter. That is the whole point of
 * the ordering: the stream carries thousands of filings, but only a few hundred belong to companies
 * worth a call, and each filing is one request.
 */
async function ingestFinancials(filings: Filing[]) {
  const ids = new Set<string>()
  const rl = createInterface({ input: (await open(`${RAW}/companies.jsonl`)).createReadStream() })
  for await (const line of rl) if (line.trim()) ids.add(JSON.parse(line).businessId)

  const wanted = filings.filter((f) => ids.has(f.businessId))
  console.log(`Tilinpäätöksiä haettavana: ${wanted.length} (${filings.length} virrassa)`)

  const out = createWriteStream(`${RAW}/financials.jsonl`)
  let done = 0
  let failed = 0
  for (const f of wanted) {
    try {
      const xml = await fetchText(filingUrl(f.businessId, f.financialDate))
      const parsed = parseFiling(xml, f.businessId, f.financialDate, f.registrationDate)
      if (parsed) out.write(JSON.stringify(parsed) + '\n')
      else failed++
    } catch {
      failed++
    }
    if (++done % 50 === 0) console.log(`  ${done}/${wanted.length}`)
    await sleep(350)
  }
  await new Promise((r) => out.end(r))
  console.log(`Luvut valmiit: ${done - failed} jäsennetty, ${failed} epäonnistui`)
}

/* --------------------------------------------------------------------- main */

const kept = await ingestRegister()
if (!kept) throw new Error('register filter produced nothing, check MIN_AGE and industries')
const filings = await ingestFilings()
await ingestFinancials(filings)
console.log('\nValmis. Seuraavaksi: npm run build:targets')
