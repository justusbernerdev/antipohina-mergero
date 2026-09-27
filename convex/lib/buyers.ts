import type { Buyer, Company, Financials } from './types'

/**
 * Buyer criteria.
 *
 * Mergero holds 2,000+ verified buyers and €52B of stated appetite. We cannot see that book, so this
 * file is a public stand-in built from their own published transactions and roll-up cases: who
 * actually bought, in which sector, at what size. In a pilot this file is replaced by their export
 * and nothing else changes.
 *
 * The point of matching here is not to serve the buyer. It is to give the OWNER a reason to reply:
 * "three of the buyers we work with fit your company, and one of them bought in your sector last
 * year." That sentence is only possible if the buyer side is loaded first.
 */
export const BUYERS: Buyer[] = [
  {
    id: 'sponsor-capital',
    name: 'Sponsor Capital',
    kind: 'private equity',
    industries: ['81210', '81220', '81291', '81100', '62010', '38110', '38320', '25110', '25620'],
    minSize: 2_000_000,
    maxSize: 100_000_000,
    evidence:
      'Appears three times in Mergero public material: Saarni Cloud (software), Fluo Group (circular economy) and Fasteo Group (technical wholesale). Buys platforms and builds on them.',
    source: 'Mergero opening deck, roll-up track record',
  },
  {
    id: 'pika-puhtaus',
    name: 'PiKa Puhtaus',
    kind: 'serial acquirer',
    industries: ['81210', '81220', '81291', '81100'],
    minSize: 500_000,
    maxSize: 15_000_000,
    evidence:
      'Acquired Clean-Kalle Ab Oy, a cleaning company founded in 1970, in a Mergero 2026 transaction. Same industry code as its target.',
    source: 'Mergero 2026 transactions',
  },
  {
    id: 'kotera-group',
    name: 'Kotera Group',
    kind: 'serial acquirer',
    industries: ['43220', '43210', '43290', '43120', '43991', '33200', '25110'],
    minSize: 1_000_000,
    maxSize: 40_000_000,
    evidence:
      '16 acquisitions since founding, revenue ~€185M in 2025 and ~€260M forecast for 2026, IPO targeted 2028-29. Buys industrial construction and installation businesses one at a time.',
    source: 'Mergero opening deck, roll-up track record',
  },
  {
    id: 'luo-logistics',
    name: 'Luo Logistics Group',
    kind: 'serial acquirer',
    industries: ['49410', '49310', '52100', '52240'],
    minSize: 1_000_000,
    maxSize: 40_000_000,
    evidence:
      'Merged Huhtala Logistics and Puura-Trans, later adding Weeman. Revenue ~€80M in 2025 and group value more than tripled. Backed by Lease Deal Group.',
    source: 'Mergero opening deck, roll-up track record',
  },
  {
    id: 'hig-capital',
    name: 'H.I.G. Capital',
    kind: 'private equity',
    industries: ['38110', '38320', '39000', '49410', '52100'],
    minSize: 10_000_000,
    maxSize: 100_000_000,
    evidence:
      'Acquired the majority of Fluo Group in August 2025 after Sponsor Capital built the platform. Enters once a group has been assembled.',
    source: 'Mergero opening deck, roll-up track record',
  },
  {
    id: 'no-dig-alliance',
    name: 'No Dig Alliance',
    kind: 'serial acquirer',
    industries: ['43220', '43290', '43120', '43110'],
    minSize: 500_000,
    maxSize: 20_000_000,
    evidence: 'Acquired Suomen Putkisto Palvelu in a Mergero 2026 transaction. Consolidates pipeline services.',
    source: 'Mergero 2026 transactions',
  },
  {
    id: 'teqnion',
    name: 'Teqnion',
    kind: 'serial acquirer',
    industries: ['25110', '25620', '25730', '25990', '28990', '33120', '33200', '22290', '23610'],
    minSize: 1_000_000,
    maxSize: 30_000_000,
    evidence:
      'Listed Swedish acquirer of small industrial businesses with an eternal holding period, 36 companies owned. Bought Norband in a Mergero 2026 transaction, its route into Finland.',
    source: 'Mergero 2026 transactions, Teqnion public reporting',
  },
  {
    id: 'wesports-group',
    name: 'WeSports Group',
    kind: 'serial acquirer',
    industries: ['93130', '96011'],
    minSize: 300_000,
    maxSize: 10_000_000,
    evidence: 'Acquired Elite Fitness in a Mergero 2026 transaction. Consolidates gyms and sports venues.',
    source: 'Mergero 2026 transactions',
  },
]

/**
 * Match a scored company against the buyer book.
 *
 * Deliberately strict: sector must overlap and size must fit. A loose match produces the kind of
 * mass mailing Mergero's own values rule out ("Discretion > Publicity"). Better to send nothing
 * than to send an owner a buyer who would never call back.
 */
export function matchBuyers(
  company: Company,
  financials: Financials,
  /**
   * Units of local currency per euro. Buyer criteria are stated in euros, so a Norwegian figure in
   * kroner has to be converted before it can be compared. Defaults to 1 for euro countries.
   */
  perEuro = 1,
): { buyer: Buyer; why: string }[] {
  const size = financials.balanceProxy / perEuro
  return BUYERS.filter(
    (b) => b.industries.includes(company.industry) && size >= b.minSize && size <= b.maxSize,
  ).map((buyer) => ({
    buyer,
    why:
      buyer.kind === 'serial acquirer'
        ? `Ostaa samalta toimialalta toistuvasti ja kokoluokka osuu.`
        : `Sijoittaa tähän toimialaan ja kokoluokkaan.`,
  }))
}
