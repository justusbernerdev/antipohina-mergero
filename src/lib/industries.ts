/**
 * Industries where ownership actually changes hands in the lower mid-market.
 *
 * The list is not a guess. Every one of Mergero's public 2026 transactions and roll-up cases lands
 * in it: cleaning (PiKa x Clean-Kalle), plumbing (No Dig Alliance), industrial construction (Kotera),
 * logistics (Luo), technical wholesale (Fasteo), waste and recycling (Fluo), gyms, pharmacies.
 *
 * These sectors share the profile that makes a roll-up work: fragmented, local, unglamorous,
 * owner-led, and priced on cash flow rather than a story.
 */
export const CONSOLIDATING: Record<string, string> = {
  // Property services
  '81210': 'Kiinteistöjen siivous',
  '81220': 'Erikoissiivous',
  '81291': 'Muu siivous',
  '81100': 'Kiinteistöpalvelu',
  '81300': 'Viherrakentaminen',
  '68320': 'Kiinteistönhoito',
  '80100': 'Vartiointi',

  // Installation and construction trades
  '43220': 'LVI-asennus',
  '43210': 'Sähköasennus',
  '43290': 'Muu rakennusasennus',
  '43120': 'Maarakennus',
  '43110': 'Purkutyöt',
  '43310': 'Rappaus',
  '43330': 'Lattiatyöt',
  '43341': 'Maalaus',
  '43991': 'Muu erikoisrakentaminen',

  // Transport and warehousing
  '49410': 'Tieliikenteen tavarankuljetus',
  '49310': 'Paikallisliikenne',
  '52100': 'Varastointi',
  '52240': 'Lastinkäsittely',

  // Metal and machinery
  '25110': 'Metallirakenteet',
  '25620': 'Metallin työstö',
  '25730': 'Työkalut',
  '25990': 'Metallituotteet',
  '28990': 'Erikoiskoneet',
  '33120': 'Koneiden korjaus',
  '33200': 'Teollinen asennus',

  // Health and care
  '86210': 'Terveyskeskuspalvelut',
  '86220': 'Erikoislääkäripalvelut',
  '86230': 'Hammaslääkäripalvelut',
  '86901': 'Fysioterapia',
  '87101': 'Hoivalaitos',
  '87301': 'Vanhusten hoiva',
  '88101': 'Kotipalvelut',

  // Vehicles
  '45201': 'Autokorjaamo',
  '45203': 'Autopesu',
  '45112': 'Autojen vähittäiskauppa',

  // Technical services
  '71121': 'Yhdyskuntasuunnittelu',
  '71122': 'Rakennetekniikka',
  '71125': 'Tekninen palvelu',
  '71201': 'Tekninen testaus',
  '62010': 'Ohjelmistot',
  '62020': 'Atk-konsultointi',
  '95110': 'Tietokoneiden korjaus',

  // Manufacturing and food
  '10130': 'Lihanjalostus',
  '10710': 'Leipomo',
  '10890': 'Elintarvikkeet',
  '13920': 'Tekstiilituotteet',
  '16231': 'Puusepäntyöt',
  '22290': 'Muovituotteet',
  '23610': 'Betonituotteet',

  // Circular economy
  '38110': 'Jätteenkeruu',
  '38320': 'Kierrätys',
  '39000': 'Ympäristöpuhdistus',

  // Consumer services
  '93130': 'Kuntokeskus',
  '96011': 'Pesula',
}

/**
 * Holding and property vehicles pollute every register query. They are legally companies but
 * there is no business to sell, so they are dropped before scoring rather than scored low.
 */
export const EXCLUDE_NAME =
  /\b(holding|invest|investment|capital|partners|asunto|kiinteist[oö]|as oy|konserni|sijoitus|rahasto)\b/i
