import type { Buyer, Company, Financials } from './types'

/**
 * The opener, written from the target's own facts.
 *
 * This is deliberately the least clever file in the repository. Every sentence has to be true of
 * this specific company and checkable by the owner within a minute, because the whole argument for
 * the engine is that the first contact says something the owner could not get anywhere else. A
 * sentence that is true of everyone — "we work with many buyers in your sector" — is worth nothing
 * and costs the sender their credibility.
 *
 * So: no claim that is not derived from the arguments. If nobody in the book has actually bought in
 * this industry, that clause simply does not appear.
 */

const NUMW = ['ei yhtäkään', 'yksi', 'kaksi', 'kolme', 'neljä', 'viisi']

const money = (n: number, currency: string) =>
  currency === 'NOK'
    ? `${(n / 1e6).toFixed(1).replace('.', ',')} M kr`
    : `${(n / 1e6).toFixed(1).replace('.', ',')} M€`

/** The owner reads dates the way they write them, not the way the register stores them. */
const fiDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return d ? `${Number(d)}.${Number(m)}.${y}` : iso
}

export function draft(
  company: Company,
  financials: Financials,
  matches: { buyer: Buyer; why: string }[],
  currency: string,
  lateMonths: number,
): string {
  const n = matches.length
  const count = NUMW[n] ?? String(n)
  // "Sähköasennus" reads better mid-sentence in lower case; "LVI-asennus" does not.
  const sector = /^\p{Lu}{2,}/u.test(company.industryName)
    ? company.industryName
    : company.industryName.charAt(0).toLowerCase() + company.industryName.slice(1)
  const bought = matches.filter((m) => m.buyer.kind === 'serial acquirer').length
  const Bought = (NUMW[bought] ?? String(bought)).replace(/^./, (c) => c.toUpperCase())

  const observation =
    lateMonths > 0
      ? `Tilinpäätöksenne tilikaudelta ${financials.financialDate.slice(0, 4)} rekisteröitiin ${fiDate(financials.registrationDate)}, noin ${lateMonths} kk määräajan jälkeen.`
      : `Tilinpäätöksenne rekisteröitiin ${fiDate(financials.registrationDate)}, eli näitte lukunne juuri.`

  const size = `${money(financials.balanceProxy, currency)}${currency === 'EUR' ? ', taseen loppusumma' : ', liikevaihto'}`

  const lines = [
    `Hyvä ${company.name}:n omistaja,`,
    ``,
    observation,
    `Kokoluokka julkisen tilinpäätöksen perusteella on ${size}.`,
    ``,
    n === 0
      ? `Emme ota yhteyttä myydäksemme mitään. Kerromme mielellämme mitä ${sector}-alalla tämän kokoisista yhtiöistä tällä hetkellä maksetaan.`
      : n === 1 && bought === 1
        ? `Työskentelemme yritysostajien kanssa, ja yksi heistä täyttää ${sector}-alan ja tämän kokoluokan kriteerit. Sama ostaja on ostanut samalta toimialalta aiemmin.`
        : `Työskentelemme yritysostajien kanssa, ja heistä ${count} täyttää ${sector}-alan ja tämän kokoluokan kriteerit${
            bought > 0
              ? `. ${bought === 1 ? 'Yksi heistä on' : `${Bought} heistä on`} ostanut samalta toimialalta aiemmin`
              : ''
          }.`,
    ``,
    `Jos omistajanvaihdos on ajankohtainen lähivuosina, keskustellaan luottamuksellisesti. Se ei sido mihinkään.`,
    ``,
    `Mergero`,
  ]

  return lines.join('\n')
}
