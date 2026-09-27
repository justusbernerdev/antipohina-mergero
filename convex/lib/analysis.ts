import type { Buyer, Company, Financials } from './types'

/**
 * What we can say about one company, and what we cannot.
 *
 * This replaces an earlier version that wrote a ready-made opening message. That was the wrong
 * output twice over. It put words in an advisor's mouth, and because it had to read fluently it
 * quietly asserted things the data did not support — it told a Norwegian owner their filing had
 * just been registered, when the only date Norway publishes is the end of the financial period.
 *
 * Structured findings cannot do that. Every fact carries the basis it rests on, every limit is
 * named rather than smoothed over, and the open questions are listed as open questions. What an
 * advisor says to the owner is theirs to write.
 */

export type Fact = { label: string; value: string; basis?: string }
export type Analysis = {
  headline: string
  facts: Fact[]
  /** Things public data cannot answer here. Naming them is the point, not an apology. */
  limits: string[]
  /** What to establish next — in practice, where Mergero's own data takes over. */
  open: string[]
}

const money = (n: number, currency: string) =>
  currency === 'NOK'
    ? `${(n / 1e6).toFixed(1).replace('.', ',')} M kr`
    : `${(n / 1e6).toFixed(1).replace('.', ',')} M€`

const fiDate = (iso: string) => {
  const [y, m, d] = (iso ?? '').split('-')
  return d ? `${Number(d)}.${Number(m)}.${y}` : iso
}

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))} %`

export function analyse(
  company: Company,
  financials: Financials,
  matches: { buyer: Buyer; why: string }[],
  country: string,
  currency: string,
  age: number,
  lateMonths: number,
  lastFiledYear: number | null,
): Analysis {
  const isNO = country === 'NO'
  // "Sähköasennus" reads better in lower case mid-sentence; "LVI-asennus" does not.
  const sector = /^\p{Lu}{2,}/u.test(company.industryName)
    ? company.industryName
    : company.industryName.charAt(0).toLowerCase() + company.industryName.slice(1)
  const serial = matches.filter((m) => m.buyer.kind === 'serial acquirer').length

  const facts: Fact[] = []

  facts.push({
    label: isNO ? 'Liikevaihto' : 'Taseen loppusumma',
    value: money(financials.balanceProxy, currency),
    basis: isNO
      ? 'Luettu rekisteröidystä tilinpäätöksestä. Norja julkaisee liikevaihdon ja liiketuloksen suoraan.'
      : 'Luettu XBRL-dokumentista. Kokoluokan proxy: pieni suomalainen yhtiö ei julkaise liikevaihtoa eikä käyttökatetta.',
  })

  if (financials.balanceProxyPrev !== null && financials.changePct !== null) {
    facts.push({
      label: 'Muutos edelliseen tilikauteen',
      value: `${pct(financials.changePct)} (${money(financials.balanceProxyPrev, currency)} → ${money(financials.balanceProxy, currency)})`,
      basis: 'Vertailukausi samasta dokumentista, ei erillistä hakua.',
    })
  } else {
    facts.push({
      label: 'Muutos edelliseen tilikauteen',
      value: 'Ei saatavilla',
      basis: isNO
        ? 'Rekisteri palauttaa yhden tilikauden kerrallaan, joten suuntaa ei voi lukea.'
        : 'Vertailukautta ei löytynyt dokumentista.',
    })
  }

  /**
   * Timing is the signal the engine runs on, and the two countries produce it differently. Finland
   * publishes the day a filing was registered. Norway does not, so the only honest statement is
   * which financial year was last filed and how far behind that is.
   */
  if (isNO) {
    const behind = lastFiledYear === null ? null : new Date().getFullYear() - 1 - lastFiledYear
    facts.push({
      label: 'Tilinpäätöksen tuoreus',
      value:
        lastFiledYear === null
          ? 'Ei tiedossa'
          : behind && behind >= 1
            ? `Viimeisin jätetty tilikausi ${lastFiledYear} · ${behind} v jäljessä`
            : `Viimeisin jätetty tilikausi ${lastFiledYear} · ajan tasalla`,
      basis:
        'Norjassa ei ole päivättyä tilinpäätösvirtaa. Ajoitus luetaan siitä mikä tilikausi on viimeksi jätetty, ei rekisteröintipäivästä, jota ei julkaista.',
    })
    facts.push({
      label: 'Tilikausi päättyi',
      value: fiDate(financials.financialDate),
      basis: 'Tilinpäätöksen kattama jakso, ei rekisteröintipäivä.',
    })
  } else {
    facts.push({
      label: 'Tilinpäätös rekisteröity',
      value: `${fiDate(financials.registrationDate)}${lateMonths > 0 ? ` · ${lateMonths} kk yli määräajan` : ' · määräajassa'}`,
      basis:
        lateMonths > 0
          ? 'Määräaika on kahdeksan kuukautta tilikauden päättymisestä. Myöhässä jätetty tilinpäätös on havainto, ei virhe: se kertoo että jokin on kesken.'
          : 'Tuore rekisteröinti tarkoittaa että omistaja on juuri nähnyt omat lukunsa.',
    })
  }

  facts.push({
    label: 'Ikä ja toimiala',
    value: `${age} v · ${company.industry} ${company.industryName}`,
    basis: 'Rekisteröintipäivä kaupparekisteristä, toimiala yhtiön oma päätoimiala.',
  })

  facts.push({
    label: isNO ? 'Henkilöstö' : 'Työnantajarekisteri',
    value: company.employer ? 'Kyllä' : 'Ei',
    basis: isNO
      ? 'Henkilöstömäärä rekisteritiedossa. Nolla tarkoittaa yleensä ettei liiketoimintaa ole.'
      : 'Työnantajarekisterissä oleminen tarkoittaa palkanmaksua, eli toimivaa liiketoimintaa eikä kuorta.',
  })

  if (company.renames === 0) {
    facts.push({
      label: 'Nimenmuutokset',
      value: 'Ei yhtäkään',
      basis: 'Yhtiö ei ole koskaan vaihtanut nimeään, joka on heikko merkki siitä ettei omistus ole vaihtunut näkyvästi.',
    })
  }

  facts.push({
    label: 'Ostajaosumat',
    value:
      matches.length === 0
        ? 'Ei yhtään nykyisillä kriteereillä'
        : `${matches.length} · ${matches.map((m) => m.buyer.name).join(', ')}`,
    basis:
      matches.length === 0
        ? `Toimialalla on ostajia, mutta yksikään ei osu tähän kokoluokkaan.`
        : serial > 0
          ? `Heistä ${serial} on sarjaostaja, eli on ostanut ${sector}-alalta aiemmin. Peruste on julkinen ja merkitty jokaisen kohdalle.`
          : 'Kriteerit täyttyvät toimialan ja kokoluokan osalta.',
  })

  // Place names are left uninflected on purpose: guessing a Finnish case for a Norwegian town
  // produces "Haugesundsta", and a wrong word in the first line costs more than a plain one.
  const town = company.city ? `${company.city.charAt(0)}${company.city.slice(1).toLowerCase()}` : null
  const headline = [
    `${age}-vuotias ${sector}-alan yhtiö`,
    town ? `kotipaikka ${town}` : null,
    `${isNO ? 'liikevaihto' : 'tase'} ${money(financials.balanceProxy, currency)}`,
    matches.length === 0
      ? 'ei ostajaosumia'
      : `${matches.length} ${matches.length === 1 ? 'ostaja' : 'ostajaa'} kriteereissä`,
  ]
    .filter(Boolean)
    .join(', ')

  const limits = isNO
    ? [
        'Käyttökatetta ei julkaista, eikä sitä arvata liikevaihdosta.',
        'Vertailukautta ei palaudu rekisteristä, joten kehityssuuntaa ei voi lukea tästä.',
        'Omistajaa ei saa nimellä. Rekisteri kertoo vain onko yhtiö jo konsernissa, eli käytännössä onko se jo ostettu.',
      ]
    : [
        'Taseen loppusumma ei ole liikevaihto eikä käyttökate. Se on kokoluokan arvio.',
        'Omistajaa ei saa Suomen julkisesta datasta lainkaan. Henkilönimi yhtiön nimessä on proxy, ei tieto.',
        'Tilinpäätösten kattavuus digitaalisessa muodossa on ohut, joten poissaolo ikkunasta ei tarkoita ettei yhtiö ole jättänyt tilinpäätöstä.',
      ]

  const open = [
    'Kuka omistaa ja minkä ikäinen hän on. Tämä on se kohta jossa Mergeron oma data kytkeytyy putkeen.',
    isNO
      ? 'Toteutunut käyttökate ja sen kehitys, jotta yritysarvo voidaan haarukoida.'
      : 'Liikevaihto ja käyttökate, jotta kokoluokka tarkentuu yritysarvoksi.',
    'Onko yhtiöllä jo neuvonantaja tai käynnissä oleva prosessi.',
  ]

  return { headline, facts, limits, open }
}
