'use client'

import { use } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

/**
 * The artefact.
 *
 * This is what the owner receives instead of a cover letter: one page about their own company,
 * built from their own registered filing, naming the buyer interest that already exists. It is
 * quiet, it is checkable, and it is different for every owner — which is why it scales to thousands
 * without becoming a mass mailing.
 *
 * It reads the most recent run that found them, so the figures are whatever the register last said
 * rather than whatever was true when someone committed a JSON file.
 */

const money = (n: number, c: string) =>
  c === 'NOK' ? `${(n / 1e6).toFixed(1).replace('.', ',')} M kr` : `${(n / 1e6).toFixed(1).replace('.', ',')} M€`

const fiDate = (iso: string) => {
  const [y, m, d] = (iso ?? '').split('-')
  return d ? `${Number(d)}.${Number(m)}.${y}` : iso
}

export default function Kohde({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = use(params)
  const found = useQuery(api.runs.findTarget, { businessId: bid })

  if (found === undefined) {
    return (
      <main className="wrap">
        <p className="lede" style={{ marginTop: 60 }}>
          Haetaan…
        </p>
      </main>
    )
  }

  if (found === null) {
    return (
      <main className="wrap">
        <h1 style={{ marginTop: 60 }}>Ei tietoja</h1>
        <p className="lede">
          Tunnusta <b>{bid}</b> ei löytynyt yhdestäkään viimeisimmästä ajosta. Se ei tarkoita että
          yhtiössä olisi jotain vikaa: se tarkoittaa ettei se osunut viimeksi ajettuihin kriteereihin.
        </p>
      </main>
    )
  }

  const t = found.target
  const city = t.city ? t.city.charAt(0) + t.city.slice(1).toLowerCase() : null
  const serial = t.buyers.filter((b) => b.kind === 'serial acquirer').length
  const isNO = t.currency === 'NOK'

  return (
    <>
      <header className="top">
        <div className="wrap">
          <span className="brand">Mergero</span>
          <span className="dim">
            {isNO ? 'Org.nr' : 'Y-tunnus'} {t.businessId}
          </span>
        </div>
      </header>

      <main className="wrap">
        <span className="kick">Mitä omistaja saa</span>
        <h1>{t.name}</h1>
        <p className="lede">
          {city ? `${city} · ` : ''}
          {t.industryName} · perustettu {t.registered.slice(0, 4)}
        </p>

        <div className="stats">
          <div className="stat">
            <b>{money(t.size, t.currency)}</b>
            <span>
              {isNO ? 'liikevaihto' : 'taseen loppusumma'}, tilikausi {t.financialDate.slice(0, 4)}
            </span>
          </div>
          <div className="stat">
            <b>{t.changePct === null ? '—' : `${t.changePct > 0 ? '+' : '−'}${Math.abs(Math.round(t.changePct))} %`}</b>
            <span>muutos edelliseen tilikauteen</span>
          </div>
          <div className="stat">
            <b>{t.age} v</b>
            <span>yhtiön ikä</span>
          </div>
          <div className="stat">
            <b>{t.buyers.length}</b>
            <span>ostajaa joiden kriteerit täyttyvät</span>
          </div>
        </div>

        <div className="note">
          {t.filedAt ? (
            <>
              Tilinpäätöksenne rekisteröitiin <b>{fiDate(t.filedAt)}</b>.{' '}
            </>
          ) : (
            <>
              Viimeisin rekisteröity tilinpäätöksenne koskee tilikautta, joka päättyi{' '}
              <b>{fiDate(t.financialDate)}</b>.{' '}
            </>
          )}
          Kaikki tällä sivulla oleva on julkista tietoa, jonka voitte itse tarkistaa{' '}
          <a href={t.verifyUrl} target="_blank" rel="noreferrer">
            rekisteristä
          </a>
          . Emme ole ostaneet teistä mitään tietoa emmekä ole puhuneet kenellekään yhtiöstänne.
        </div>

        <h2>Ketkä ostaisivat</h2>
        {t.buyers.length === 0 ? (
          <p className="lede">Ei osumia nykyisillä kriteereillä.</p>
        ) : (
          <>
            <p className="lede">
              Ostajakirjassamme on {t.buyers.length} ostajaa, joiden toimiala- ja kokoluokkakriteerit
              täyttyvät kohdallanne
              {serial > 0 && (
                <>
                  , ja heistä <b>{serial}</b> on ostanut samalta toimialalta aiemmin
                </>
              )}
              .
            </p>
            {t.buyers.map((b) => (
              <div className="card" key={b.id}>
                <h3>{b.name}</h3>
                <p className="dim" style={{ margin: '0 0 8px' }}>
                  {b.kind}
                </p>
                <p style={{ margin: '0 0 8px' }}>{b.why}</p>
                <p className="dim" style={{ margin: 0 }}>
                  {b.evidence} <i>Lähde: {b.source}.</i>
                </p>
              </div>
            ))}
          </>
        )}

        <h2>Miksi juuri nyt</h2>
        <div className="tags">
          {t.reasons.map((r) => (
            <span className="tag" key={r.label}>
              {r.label} <b>+{r.points}</b>
            </span>
          ))}
        </div>

        <h2>Mihin tämä perustuu</h2>
        <p className="lede">{t.analysis.headline}</p>
        {t.analysis.facts.map((f) => (
          <div className="card" key={f.label}>
            <h3>
              {f.label}: {f.value}
            </h3>
            {f.basis && (
              <p className="dim" style={{ margin: 0 }}>
                {f.basis}
              </p>
            )}
          </div>
        ))}

        <h2>Mitä julkinen data ei kerro</h2>
        <ul className="lede" style={{ paddingLeft: 20 }}>
          {t.analysis.limits.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>

        <div className="caveat">
          <b>Mikään ei ole lähtenyt kenellekään.</b> Tämä sivu on koottu julkisesta datasta, ja jos
          keskustelu alkaa, sen aloittaa ihminen eikä kone.{' '}
          {isNO
            ? 'Liikevaihto luetaan rekisteröidystä tilinpäätöksestä suoraan. Käyttökatetta ei julkaista, eikä sitä arvata.'
            : 'Taseen loppusumma ei ole liikevaihto eikä käyttökate. Pieni suomalainen yhtiö ei ole velvollinen julkaisemaan kumpaakaan, joten luku on kokoluokan arvio julkisesta tilinpäätöksestä.'}{' '}
          Yritysarvoksi se tarkennetaan Mergeron omalla datalla.
        </div>
      </main>

      <footer>
        <div className="wrap">
          Kaikki luvut yhtiön omasta rekisteröidystä tilinpäätöksestä. Tarkistettavissa tunnuksella{' '}
          {t.businessId}.
        </div>
      </footer>
    </>
  )
}
