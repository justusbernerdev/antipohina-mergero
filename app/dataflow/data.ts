/**
 * Everything the dataflow view says, in both languages, and the lane figures it animates.
 *
 * Self-contained on purpose: this view is meant to be shown on its own, and nothing else in the
 * repository should be able to change what it claims.
 */

export const ACC = '#0028ff'

/**
 * Thousands separator by hand rather than `toLocaleString`. The view renders once on the server
 * and again in the browser, and the two runtimes do not always agree on which space character
 * separates the groups — one disagreement fails hydration.
 */
export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const INS = ['api', 'mcp'] as const
export const OUTS = ['api', 'mcp', 'selda'] as const

export const REQ = `curl -X POST {SITE}/v1/runs \\
  -H 'content-type: application/json' -d '{
  "countries": ["FI", "NO"],
  "industries": ["43*", "49*", "81*"],
  "minAgeYears": 15,
  "minSize": { "FI": 1500000, "NO": 15000000 },
  "filingWindowDays": 70,
  "excludeHolding": true,
  "limit": 200
}'

202 Accepted
{ "run_id": "j97e5wjm...", "status": "queued",
  "poll": "/v1/runs/j97e5wjm..." }`

export const RES = `curl {SITE}/v1/runs/{RUN}/targets?limit=1

200 OK
{
  "business_id": "0152307-3",
  "name": "Riihimäen Öljypoltinhuolto Oy",
  "country": "FI", "age": 48,
  "currency": "EUR", "size": 3940000, "change_pct": -39,
  "filed_at": "2026-09-24",
  "score": 15,
  "reason": ["48 vuotta vanha", "Tilinpäätös rekisteröity juuri",
             "Tase supistui 39 %", "Henkilönimi yhtiön nimessä"],
  "buyers": ["Kotera Group", "No Dig Alliance"],
  "status": "awaiting_human",
  "verify": "https://tietopalvelu.ytj.fi/yritys/0152307-3"
}`

const MCPCFG = `{
  "mcpServers": {
    "originaatio": {
      "type": "http",
      "url": "{SITE}/mcp",
      "headers": { "Authorization": "Bearer <avain>" }
    }
  }
}`

const TOOLS = `start_run      kriteerit → ajo (palaa heti, kysy tilaa get_run:lla)
get_run        ajo → vaiheet ja maakohtaiset luvut
get_targets    ajo → kohteet, ostajat, luonnos
explain        kohde → pisteytys, luvut, lähteet`

/** title, body, rules */
type Desc = [string, string, string[]]
/** title, body, code */
type Step = [string, string, string]

export type Page = { name: string; status: string; lead: string; cta: string; steps: Step[] }

export type Lang = {
  title: string
  cc: string
  countries: string
  par: string
  one: string
  soon: string
  in: string
  out: string
  back: string
  flowNav: string
  open: string
  nodes: string[]
  crit: string
  desc: Desc[]
  ins: Record<string, string[]>
  outs: Record<string, string[]>
  pages: Record<string, Page>
}

export const L: Record<'fi' | 'en', Lang> = {
  fi: {
    title:
      'Kerro mitä etsit. Kone käy läpi valittujen maiden kaupparekisterit rinnakkain ja palauttaa kohteet ja sopivat ostajat.',
    cc: 'Maat',
    countries: 'Maat',
    par: 'maata rinnakkain',
    one: '1 maa',
    soon: 'tulossa',
    in: 'Sisään',
    out: 'Ulos',
    back: 'Takaisin dataflow’hun',
    flowNav: 'Dataflow',
    open: 'Kytkentäohje →',
    nodes: ['Kriteerit', 'Lähde', 'Rekisteri', 'Tilinpäätökset', 'Luvut', 'Pisteytys', 'Ostajat'],
    crit: '6 ehtoa',
    desc: [
      [
        'Kriteerit',
        'Pyyntö API:n tai MCP:n kautta määrää mitä putki etsii. Jokainen ehto muuttuu säännöksi jossakin vaiheessa.',
        [
          'Maa: Suomi',
          'Toimialat: 43, 49, 81',
          'Ei holding eikä kiinteistö',
          'Ikä vähintään 15 v',
          'Tase vähintään 1,5 M€',
          'Tilinpäätös viimeisen 70 päivän ajalta',
        ],
      ],
      [
        'PRH avoin data',
        'Koko kaupparekisteri yhtenä tiedostona. CC BY 4.0, ei API-avainta, 0 €.',
        ['all_companies', 'all_financial_statements', 'financial/{businessId}'],
      ],
      [
        'Rekisteri',
        'Suodatus paikallisesti.',
        ['Aktiivinen osakeyhtiö', 'Ei holding eikä kiinteistö', 'Toimiala kriteereissä', 'Ikä vähintään 15 v'],
      ],
      [
        'Tilinpäätökset',
        'Uudet tilinpäätökset ikkunassa. Pudonneet eivät ole huonoja kohteita, niiden hetki ei ole nyt.',
        ['Rekisteröity 70 päivän sisällä', 'Y-tunnus kohdejoukossa', 'Myöhästyminen on signaali'],
      ],
      [
        'XBRL-luvut',
        'Tase luetaan dokumentista, ei arvata.',
        ['XBRL luettavissa', 'Tase ja vertailukausi', 'Tase vähintään 1,5 M€'],
      ],
      [
        'Pisteytys',
        'Kaikki maat yhteen jonoon. Järjestää, ei seulo. Kukaan ei putoa.',
        ['Ajoitus', 'Toimiala', 'Ikä', 'Tase', 'Omistaja', 'Sijainti'],
      ],
      ['Ostajat', 'Jokainen kohde ostajakirjaa vastaan.', ['Toimiala täsmää', 'Kokoluokka täsmää', 'Maa täsmää']],
    ],
    ins: {
      api: ['API', 'Kriteerit JSON-pyyntönä omasta järjestelmästä.', REQ],
      mcp: [
        'MCP',
        'Kriteerit luonnollisella kielellä agentin tai Clauden kautta.',
        `"Etsi suomalaisia ja norjalaisia sähkö-, kuljetus- ja kiinteistöhuoltoyhtiöitä,
 vähintään 15 vuotta vanhoja."

→ start_run  { "countries": ["FI","NO"], "industries": ["43*","49*","81*"],
               "minAgeYears": 15 }
← { "run": "j97e5wjm...", "status": "queued" }`,
      ],
    },
    outs: {
      api: ['API', 'REST · JSON', 'Tulokset rajapinnasta omaan järjestelmään. Sama rivi, perustelut mukana.', RES],
      mcp: [
        'MCP',
        'agentit',
        'Agentti kysyy tuloksia suoraan.',
        `→ get_targets  { "run": "j97e5wjm...", "limit": 3 }

Riihimäen Öljypoltinhuolto Oy   15 p · 2 ostajaa · FI
ARNE HANSEN INSTALLASJON AS     14 p · 1 ostaja  · NO
B MIKKELSEN AS                  14 p · 1 ostaja  · NO`,
      ],
      selda: [
        'Selda',
        '→ MGX',
        'Rivi laskeutuu Seldaan ja sieltä MGX:ään. Ihminen päättää, kone ei lähetä mitään itse.',
        `Selda  ← rivit ajosta, luonnos mukana

Riihimäen Öljypoltinhuolto Oy   15 p · 2 ostajaa · odottaa ihmistä
ARNE HANSEN INSTALLASJON AS     14 p · 1 ostaja  · odottaa ihmistä
…

→ MGX  kun ihminen hyväksyy`,
      ],
    },
    pages: {
      api: {
        name: 'API',
        status: 'Ei kytketty',
        lead: 'Kriteerit sisään, kohteet ulos. REST ja JSON.',
        cta: 'Pyydä API-avain',
        steps: [
          ['Pyydä avain', 'Avain luodaan kerran per järjestelmä. Sillä käynnistetään ajoja ja haetaan tuloksia.', ''],
          ['Käynnistä ajo kriteereillä', 'Kriteerit kertovat mitä putki etsii. Ajo kestää noin neljä minuuttia.', REQ],
          ['Hae tulokset', 'Jokaisella rivillä on pisteet, sopivat ostajat ja perustelut.', RES],
        ],
      },
      mcp: {
        name: 'MCP',
        status: 'Ei kytketty',
        lead: 'Agentti tai Claude käyttää moottoria suoraan, tavallisella kielellä.',
        cta: 'Pyydä MCP-avain',
        steps: [
          ['Lisää palvelin', 'Lisää Originaatio MCP-palvelimeksi agentin tai Clauden asetuksiin.', MCPCFG],
          ['Käytössä olevat työkalut', 'Kolme työkalua riittää: aja, hae, selitä.', TOOLS],
          [
            'Kysy',
            'Esimerkiksi: "Etsi suomalaisia sähköasennusyhtiöitä, joilla tilinpäätös on myöhässä, ja kerro sopivat ostajat."',
            '',
          ],
        ],
      },
      selda: {
        name: 'Selda',
        status: 'Ei kytketty',
        lead: 'Rivit laskeutuvat Seldaan ja sieltä MGX:ään. Ihminen hyväksyy.',
        cta: 'Kytke Selda',
        steps: [
          ['Yhdistä työtila', 'Selda ja Originaatio yhdistetään kerran. Ei koodia.', ''],
          [
            'Valitse mitä viedään',
            'Esimerkiksi kohteet joilla on vähintään yksi ostaja ja pisteitä vähintään 12.',
            `vie_seldaan:
  min_ostajat: 1
  min_pisteet: 12
  tila: odottaa_ihmistä`,
          ],
          [
            'Hyväksy ja vie MGX:ään',
            'Kone ei lähetä mitään itse. Ihminen hyväksyy rivin, ja se siirtyy MGX:ään.',
            '',
          ],
        ],
      },
    },
  },
  en: {
    title:
      'Say what you are looking for. The engine goes through the registries of the chosen countries in parallel and returns targets with matching buyers.',
    cc: 'Countries',
    countries: 'Countries',
    par: 'countries in parallel',
    one: '1 country',
    soon: 'coming',
    in: 'In',
    out: 'Out',
    back: 'Back to dataflow',
    flowNav: 'Dataflow',
    open: 'How to connect →',
    nodes: ['Criteria', 'Source', 'Registry', 'Filings', 'Financials', 'Scoring', 'Buyers'],
    crit: '6 rules',
    desc: [
      [
        'Criteria',
        'A request through the API or MCP sets what the pipeline looks for. Each criterion becomes a rule in one of the stages.',
        [
          'Country: Finland',
          'Industries: 43, 49, 81',
          'No holding or real-estate companies',
          'At least 15 years old',
          'Balance at least €1.5M',
          'Filing within the last 70 days',
        ],
      ],
      [
        'PRH open data',
        'The full Finnish trade register as one file. CC BY 4.0, no API key, €0.',
        ['all_companies', 'all_financial_statements', 'financial/{businessId}'],
      ],
      [
        'Registry',
        'Filtered locally.',
        ['Active limited company', 'Not a holding or real-estate company', 'Industry in criteria', 'At least 15 years old'],
      ],
      [
        'Filings',
        'New financial statements in the window. The ones that drop are not bad targets; their moment is not now.',
        ['Filed within 70 days', 'Business ID in target set', 'Late filing is a signal'],
      ],
      [
        'XBRL',
        'Balance sheet read from the document, not estimated.',
        ['XBRL readable', 'Balance and prior period', 'Balance at least €1.5M'],
      ],
      [
        'Scoring',
        'All countries in one queue. Ranks, does not filter. Nobody drops here.',
        ['Timing', 'Industry', 'Age', 'Balance', 'Owner', 'Location'],
      ],
      ['Buyers', 'Every target against the buyer book.', ['Industry match', 'Size match', 'Country match']],
    ],
    ins: {
      api: ['API', 'Criteria as a JSON request from your own system.', REQ],
      mcp: [
        'MCP',
        'Criteria in plain language through an agent or Claude.',
        `"Find Finnish and Norwegian electrical, transport and facility-services
 companies, at least 15 years old."

→ start_run  { "countries": ["FI","NO"], "industries": ["43*","49*","81*"],
               "minAgeYears": 15 }
← { "run": "j97e5wjm...", "status": "queued" }`,
      ],
    },
    outs: {
      api: ['API', 'REST · JSON', 'Results from the API into your own system. Same row, reasoning included.', RES],
      mcp: [
        'MCP',
        'agents',
        'An agent queries the results directly.',
        `→ get_targets  { "run": "j97e5wjm...", "limit": 3 }

Riihimäen Öljypoltinhuolto Oy   15 pts · 2 buyers · FI
ARNE HANSEN INSTALLASJON AS     14 pts · 1 buyer  · NO
B MIKKELSEN AS                  14 pts · 1 buyer  · NO`,
      ],
      selda: [
        'Selda',
        '→ MGX',
        'The row lands in Selda and from there in MGX. A human decides; the engine sends nothing on its own.',
        `Selda  ← rows from the run, draft included

Riihimäen Öljypoltinhuolto Oy   15 pts · 2 buyers · awaiting human
ARNE HANSEN INSTALLASJON AS     14 pts · 1 buyer  · awaiting human
…

→ MGX  once a human approves`,
      ],
    },
    pages: {
      api: {
        name: 'API',
        status: 'Not connected',
        lead: 'Criteria in, targets out. REST and JSON.',
        cta: 'Request API key',
        steps: [
          ['Request a key', 'One key per system. It starts runs and fetches results.', ''],
          ['Start a run with criteria', 'The criteria tell the pipeline what to look for. A run takes about four minutes.', REQ],
          ['Fetch results', 'Each row has a score, matching buyers and the reasoning.', RES],
        ],
      },
      mcp: {
        name: 'MCP',
        status: 'Not connected',
        lead: 'An agent or Claude uses the engine directly, in plain language.',
        cta: 'Request MCP key',
        steps: [
          ['Add the server', 'Add Originaatio as an MCP server in your agent or Claude settings.', MCPCFG.replace('<avain>', '<key>')],
          ['Available tools', 'Three tools: run, fetch, explain.', TOOLS],
          ['Ask', 'For example: "Find Finnish electrical contractors with a late filing and tell me which buyers fit."', ''],
        ],
      },
      selda: {
        name: 'Selda',
        status: 'Not connected',
        lead: 'Rows land in Selda and from there in MGX. A human approves.',
        cta: 'Connect Selda',
        steps: [
          ['Connect the workspace', 'Selda and Originaatio are connected once. No code.', ''],
          [
            'Choose what to send',
            'For example targets with at least one buyer and a score of 12 or more.',
            `send_to_selda:
  min_buyers: 1
  min_score: 12
  status: awaiting_human`,
          ],
          ['Approve and send to MGX', 'The engine sends nothing on its own. A human approves the row and it moves to MGX.', ''],
        ],
      },
    },
  },
}

export type Lane = {
  name: [string, string]
  src: string
  eps: string[]
  desc: [string, string]
  fin: [string, string]
  r4: [string[], string[]]
}

/** Only the three countries that have actually been run. The rest are chips you cannot switch on. */
export const LANES: Record<string, Lane> = {
  FI: {
    name: ['Suomi', 'Finland'],
    src: 'PRH',
    eps: ['all_companies', 'all_financial_statements', 'financial/{businessId}'],
    desc: [
      'PRH avoin data. CC BY 4.0, ei API-avainta, 0 €. Tilinpäätöksistä saadaan tase.',
      'PRH open data. CC BY 4.0, no API key, €0. Filings give the balance sheet.',
    ],
    fin: ['Tase luetaan XBRL-dokumentista, ei arvata.', 'Balance sheet read from the XBRL document, not estimated.'],
    r4: [
      ['XBRL luettavissa', 'Tase ja vertailukausi', 'Tase vähintään 1,5 M€'],
      ['XBRL readable', 'Balance and prior period', 'Balance at least €1.5M'],
    ],
  },
  NO: {
    name: ['Norja', 'Norway'],
    src: 'Brreg',
    eps: ['enheter/lastned', 'regnskapsregisteret/oppdateringer', 'regnskap/{orgnr}'],
    desc: [
      'Brønnøysundregistrene. NLOD 2.0, ei API-avainta, 0 €. Tilinpäätöksessä liikevaihto mukana.',
      'Brønnøysund Register Centre. NLOD 2.0, no API key, €0. Filings include revenue.',
    ],
    fin: ['Liikevaihto luetaan tilinpäätöksestä suoraan.', 'Revenue read directly from the filing.'],
    r4: [
      ['Tilinpäätös luettavissa', 'Liikevaihto ja vertailukausi', 'Liikevaihto vähintään 15 M kr'],
      ['Filing readable', 'Revenue and prior period', 'Revenue at least NOK 15M'],
    ],
  },
  SE: {
    name: ['Ruotsi', 'Sweden'],
    src: 'Bolagsverket',
    eps: ['foretag/lastned', 'arsredovisningar/nya', 'arsredovisning/{orgnr}'],
    desc: [
      'Bolagsverket. Avoin data, iXBRL-tilinpäätökset, liikevaihto mukana.',
      'Bolagsverket. Open data, iXBRL filings, revenue included.',
    ],
    fin: ['Liikevaihto luetaan iXBRL-tilinpäätöksestä.', 'Revenue read from the iXBRL filing.'],
    r4: [
      ['iXBRL luettavissa', 'Liikevaihto ja vertailukausi', 'Liikevaihto vähintään 15 M SEK'],
      ['iXBRL readable', 'Revenue and prior period', 'Revenue at least SEK 15M'],
    ],
  },
}

export const CHIPS = ['FI', 'NO', 'SE', 'DK', 'EE', 'UK']

/** The ticker at the foot of the diagram: id, name, where it is, fi tag, en tag, dropped. */
export const EV: [string, string, number | string, string, string, number][] = [
  ['0712348-5', 'JO-Sähkö Oy', 6, '3 ostajaa', '3 buyers', 0],
  ['1873345-0', 'Rakennus Vainio Oy', 4, 'tase alle 1,5 M€', 'balance under €1.5M', 1],
  ['1610039-9', 'Lopen Maa ja Vesirakenne Oy', 5, '15 p', '15 pts', 0],
  ['3120087-4', 'Nordic Holding Oy', 2, 'holding', 'holding', 1],
  ['0598214-2', 'Kuljetusliike Jorma Saari Oy', 'api', '200 OK', '200 OK', 0],
  ['1045872-3', 'Kiinteistöhuolto Rantanen Oy', 3, '2 kk myöhässä', '2 months late', 0],
  ['2210934-8', 'Maalaamo Heinonen Oy', 3, 'ei tilinpäätöstä ikkunassa', 'no filing in window', 1],
  ['0833901-7', 'Metallityö H. Turunen Oy', 'selda', 'odottaa ihmistä', 'awaiting human', 0],
]
