/**
 * Stage 3: hand the finished targets to the contact layer.
 *
 * This is the part the engine deliberately does not do. Public data says which company and when;
 * it does not say who the owner is or how to reach them. That is bought data, and rebuilding it
 * would be a weekend spent on a solved problem.
 *
 * What matters here is the `analysis` field. We are not handing over a name and asking for a
 * message to be invented — we hand over the finished observation, and the draft is written from it.
 * That is the same principle as everywhere else in this repo: nothing is said without a checkable
 * reason behind it.
 *
 * Nothing is sent. Drafts wait for a human in the inbox, and there is no parameter that changes
 * that.
 *
 * Usage:
 *   SELDA_API_KEY=... SELDA_PROJECT=... npm run selda -- --country fi --limit 5 --dry
 *   SELDA_API_KEY=... SELDA_PROJECT=... npm run selda -- --country fi --limit 5
 */

import { readFile } from 'node:fs/promises'
import type { Target } from '../src/lib/types.js'

const args = process.argv.slice(2)
const arg = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const DRY = args.includes('--dry')

const COUNTRY = arg('country', 'fi').toLowerCase()
const LIMIT = Number(arg('limit', '5'))
const TOKEN = process.env.SELDA_API_KEY
const PROJECT = process.env.SELDA_PROJECT
const API = process.env.SELDA_API ?? 'https://api.selda.ai/mcp/mutate'

if (!DRY && (!TOKEN || !PROJECT)) {
  console.error('Aseta SELDA_API_KEY ja SELDA_PROJECT, tai aja --dry nähdäksesi mitä lähtisi.')
  process.exit(1)
}

const file = COUNTRY === 'no' ? 'data/targets-no.json' : 'data/targets.json'
const all: Target[] = JSON.parse(await readFile(file, 'utf8'))

// A target without a website gives the contact layer nothing to work from, so it is skipped rather
// than sent and left to fail.
const targets = all.filter((t) => t.company.website).slice(0, LIMIT)
if (!targets.length) {
  console.error(`Ei kohteita joilla verkkosivu tiedossa (${file}).`)
  process.exit(1)
}

const currency = COUNTRY === 'no' ? 'NOK' : 'EUR'
const money = (n: number) =>
  currency === 'NOK'
    ? `${(n / 1e6).toFixed(1).replace('.', ',')} M NOK`
    : `${(n / 1e6).toFixed(1).replace('.', ',')} M€`

/**
 * The observation, written so a person could have written it.
 *
 * Every sentence is traceable to the public register, and the last line says where to check it.
 * A draft grounded in this cannot drift into claims the data does not support.
 */
function analysis(t: Target): string {
  const c = t.company
  const f = t.financials
  const size = currency === 'NOK' ? 'Liikevaihto' : 'Taseen loppusumma'
  const verify =
    COUNTRY === 'no'
      ? `https://virksomhet.brreg.no/nb/oppslag/enheter/${c.businessId}`
      : `https://tietopalvelu.ytj.fi/yritys/${c.businessId}`

  const lines = [
    `${c.name}, ${c.industryName.toLowerCase()}, ${c.city ?? ''}. Perustettu ${c.registered.slice(0, 4)}, eli ${t.age} vuotta vanha.`,
    `${size} ${money(f.balanceProxy)} tilikaudelta ${f.financialDate}${
      f.changePct !== null ? `, muutos edelliseen ${f.changePct > 0 ? '+' : ''}${Math.round(f.changePct)} %` : ''
    }.`,
    ``,
    `Miksi juuri nyt:`,
    ...t.reasons.map((r) => `- ${r.label}`),
  ]

  if (t.matches.length) {
    lines.push(``, `Ostajat joiden kriteerit täyttyvät (${t.matches.length}):`)
    for (const m of t.matches) {
      lines.push(`- ${m.buyer.name}, ${m.buyer.kind}. ${m.buyer.evidence} Lähde: ${m.buyer.source}.`)
    }
  }

  lines.push(
    ``,
    `Kaikki yllä oleva on julkista rekisteritietoa ja tarkistettavissa: ${verify}`,
    `Taseen loppusumma on kokoluokan arvio, ei liikevaihto eikä käyttökate: pieni yhtiö ei julkista kumpaakaan.`,
  )
  return lines.join('\n')
}

const leads = targets.map((t) => ({
  company: t.company.name,
  domain: (t.company.website ?? '').replace(/^https?:\/\//, '').replace(/^www\./, ''),
  analysis: analysis(t),
}))

if (DRY) {
  console.log(`--dry: ${leads.length} liidiä, ei lähetetä mitään\n`)
  for (const l of leads) {
    console.log(`=== ${l.company} · ${l.domain}`)
    console.log(l.analysis)
    console.log()
  }
  process.exit(0)
}

/**
 * One call per lead. Deduplication happens on Selda's side, so a re-run after a network failure
 * is safe and does not need an idempotency key of our own.
 */
let sent = 0
for (const lead of leads) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      fn: 'leads.add',
      args: {
        projectId: PROJECT,
        company: lead.company,
        companyDomain: lead.domain,
        analysis: lead.analysis,
        source: 'antipohina-mergero',
      },
    }),
  })
  if (!res.ok) {
    console.error(`  ${lead.company}: ${res.status} ${(await res.text()).slice(0, 200)}`)
    continue
  }
  sent++
  console.log(`  ${lead.company} · ${lead.domain}`)
}
console.log(`\nVietiin ${sent}/${leads.length}. Päättäjähaku ja luonnokset odottavat hyväksyntää Seldassa.`)
