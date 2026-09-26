/**
 * Optional stage 3: push the call list into an existing CRM (Selda) as leads with a draft opener.
 *
 * NOT PART OF THE DEMO. Selda is pre-existing infrastructure owned by a team member, declared here
 * in line with the hackathon rule that existing infra may sit under the pipeline as long as it is
 * not what gets demoed. The demo runs stages 1 and 2 only; this file exists to show the list does
 * not die in a JSON file.
 *
 * Nothing here sends a message. Selda drafts always wait for human approval.
 *
 * Usage:  SELDA_TOKEN=... SELDA_PROJECT=... npm run export:selda
 */

import { readFile } from 'node:fs/promises'
import type { Target } from '../src/lib/types.js'

const TOKEN = process.env.SELDA_TOKEN
const PROJECT = process.env.SELDA_PROJECT
const API = process.env.SELDA_API ?? 'https://api.selda.ai/mcp/mutate'

if (!TOKEN || !PROJECT) {
  console.error('Aseta SELDA_TOKEN ja SELDA_PROJECT. Tämä vaihe on valinnainen eikä kuulu demoon.')
  process.exit(1)
}

const targets: Target[] = JSON.parse(await readFile('data/targets.json', 'utf8'))

/**
 * The opener is the artefact, not a cover letter. It states one checkable observation, names the
 * buyer interest that already exists, and asks nothing beyond permission to show the figure.
 */
function opener(t: Target): string {
  const size = (t.financials.balanceProxy / 1e6).toFixed(1)
  const buyers = t.matches.length
  const sector = t.company.industryName.toLowerCase()
  return [
    `${t.company.name} rekisteröi tilinpäätöksensä ${t.financials.registrationDate}.`,
    `Taseen loppusumma on ${size} M€ ja yhtiö on ${t.age} vuotta vanha.`,
    ``,
    `Ostajakirjassamme on tällä hetkellä ${buyers} ostajaa joiden kriteerit täyttyvät ${sector}-alalla`,
    `tässä kokoluokassa. Yksi heistä on ostanut samalta toimialalta viimeisen vuoden aikana.`,
    ``,
    `Kerron mielelläni mitä he maksavat tämän kokoisesta yhtiöstä. Se ei sido mihinkään.`,
  ].join('\n')
}

let sent = 0
for (const t of targets) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      fn: 'events.ingest',
      args: {
        projectId: PROJECT,
        company: { name: t.company.name, domain: t.company.website ?? undefined },
        event: {
          kind: 'signal.succession',
          source: 'antipohina-mergero',
          summary: `${t.score} pistettä, ${t.matches.length} ostajaa`,
          detail: t.reasons.map((r) => r.label).join('; '),
        },
        draft: { channel: 'email', body: opener(t) },
      },
    }),
  })
  if (!res.ok) {
    console.error(`  ${t.company.name}: ${res.status}`)
    continue
  }
  sent++
}
console.log(`Vietiin ${sent}/${targets.length} liidiä. Luonnokset odottavat hyväksyntää Seldassa.`)
