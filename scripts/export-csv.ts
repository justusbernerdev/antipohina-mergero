/**
 * CSV export.
 *
 * Akseli's answer for the other challenge applies here too: a file you can open in Excel is a
 * perfectly good integration. Three files, one row per thing, and every row carries a link back to
 * the register so any figure can be checked in one click.
 *
 * Usage:  npm run csv
 */

import { readFile, writeFile } from 'node:fs/promises'
import type { Target } from '../src/lib/types.js'
import type { Acquirer } from '../src/lib/consolidation.js'

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const rows = (header: string[], data: unknown[][]) =>
  // BOM so Excel opens UTF-8 correctly; semicolons because Finnish Excel expects them.
  '﻿' + [header, ...data].map((r) => r.map(esc).join(';')).join('\n') + '\n'

const read = async <T>(p: string): Promise<T> => JSON.parse(await readFile(p, 'utf8'))

/* --------------------------------------------------------------- Finland */

const fi = await read<Target[]>('data/targets.json')
await writeFile(
  'data/kohteet-fi.csv',
  rows(
    ['pisteet', 'nimi', 'y_tunnus', 'perustettu', 'ika_v', 'toimialakoodi', 'toimiala', 'kaupunki',
     'postinumero', 'tase_eur', 'tase_edellinen', 'muutos_pct', 'tilikausi', 'tp_rekisteroity',
     'henkilonimi', 'tyonantaja', 'ostajia', 'ostajat', 'perustelut', 'tarkista'],
    fi.map((t) => [
      t.score, t.company.name, t.company.businessId, t.company.registered, t.age,
      t.company.industry, t.company.industryName, t.company.city ?? '', t.company.postCode ?? '',
      Math.round(t.financials.balanceProxy),
      t.financials.balanceProxyPrev ? Math.round(t.financials.balanceProxyPrev) : '',
      t.financials.changePct ?? '', t.financials.financialDate, t.financials.registrationDate,
      t.ownerNamed ? 'kyllä' : 'ei', t.company.employer ? 'kyllä' : 'ei',
      t.matches.length, t.matches.map((m) => m.buyer.name).join(', '),
      t.reasons.map((r) => r.label).join(' | '),
      `https://tietopalvelu.ytj.fi/yritys/${t.company.businessId}`,
    ]),
  ),
)

/* ---------------------------------------------------------------- Norway */

/** Rough NOK to EUR. Indicative only, and labelled as an estimate in the column name. */
const NOK_EUR = 11.7

try {
  const no = await read<Target[]>('data/targets-no.json')
  await writeFile(
    'data/kohteet-no.csv',
    rows(
      ['pisteet', 'nimi', 'orgnr', 'perustettu', 'ika_v', 'toimialakoodi', 'toimiala', 'kaupunki',
       'liikevaihto_nok', 'liikevaihto_eur_arvio', 'tilikausi', 'henkilonimi', 'perustelut', 'tarkista'],
      no.map((t) => [
        t.score, t.company.name, t.company.businessId, t.company.registered, t.age,
        t.company.industry, t.company.industryName, t.company.city ?? '',
        Math.round(t.financials.balanceProxy), Math.round(t.financials.balanceProxy / NOK_EUR),
        t.financials.financialDate, t.ownerNamed ? 'kyllä' : 'ei',
        t.reasons.map((r) => r.label).join(' | '),
        `https://virksomhet.brreg.no/nb/oppslag/enheter/${t.company.businessId}`,
      ]),
    ),
  )
} catch {
  console.log('data/targets-no.json puuttuu, ohitetaan Norja. Aja npm run scan:no')
}

/* ------------------------------------------------------------ Buyer book */

const buyers = await read<Acquirer[]>('data/acquirers.json')
buyers.sort((a, b) => b.acquisitions.length - a.acquisitions.length)
await writeFile(
  'data/ostajat-fi.csv',
  rows(
    ['ostoja', 'nimi', 'y_tunnus', 'toimialakoodi', 'perustettu', 'ensimmainen_osto',
     'viimeisin_osto', 'ostetut_brandit'],
    buyers.map((a) => {
      const dates = a.acquisitions.map((x) => x.date)
      return [
        a.acquisitions.length, a.name, a.businessId, a.industry, a.registered,
        dates.reduce((m, d) => (d < m ? d : m)), dates.reduce((m, d) => (d > m ? d : m)),
        // Twelve is enough to show the pattern without making the cell unreadable.
        a.acquisitions.slice(0, 12).map((x) => `${x.name} (${x.date.slice(0, 4)})`).join(' | '),
      ]
    }),
  ),
)

console.log(`kohteet-fi.csv   ${fi.length} riviä`)
console.log(`ostajat-fi.csv   ${buyers.length} riviä`)
