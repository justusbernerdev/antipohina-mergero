import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadTargets, eur, pct } from '@/lib/data'

export const dynamic = 'force-dynamic'

/**
 * The artefact.
 *
 * This is what the owner receives instead of a cover letter: one page about their own company,
 * built from their own registered filing, naming the buyer interest that already exists. It is
 * quiet, it is checkable, and it is different for every owner — which is why it scales to thousands
 * without becoming a mass mailing.
 */
export default async function Kohde({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params
  const targets = await loadTargets()
  const t = targets.find((x) => x.company.businessId === bid)
  if (!t) notFound()

  const { company: c, financials: f } = t
  const city = c.city ? c.city.charAt(0) + c.city.slice(1).toLowerCase() : null
  const serial = t.matches.filter((m) => m.buyer.kind === 'serial acquirer').length

  return (
    <>
      <header className="top">
        <div className="wrap">
          <span className="brand">
            <Link href="/">← Kohteet</Link>
          </span>
          <span className="dim">Y-tunnus {c.businessId}</span>
        </div>
      </header>

      <main className="wrap">
        <span className="kick">Mitä omistaja saa</span>
        <h1>{c.name}</h1>
        <p className="lede">
          {city ? `${city} · ` : ''}
          {c.industryName} · perustettu {c.registered.slice(0, 4)}
        </p>

        <div className="stats">
          <div className="stat">
            <b>{eur(f.balanceProxy)}</b>
            <span>taseen loppusumma, tilikausi {f.financialDate.slice(0, 4)}</span>
          </div>
          <div className="stat">
            <b>{pct(f.changePct) || '—'}</b>
            <span>muutos edelliseen tilikauteen</span>
          </div>
          <div className="stat">
            <b>{t.age} v</b>
            <span>yhtiön ikä</span>
          </div>
          <div className="stat">
            <b>{t.matches.length}</b>
            <span>ostajaa joiden kriteerit täyttyvät</span>
          </div>
        </div>

        <div className="note">
          Tilinpäätöksenne rekisteröitiin <b>{f.registrationDate}</b>. Kaikki tällä sivulla oleva on
          julkista tietoa, jonka voitte itse tarkistaa y-tunnuksella osoitteessa avoindata.prh.fi.
          Emme ole ostaneet teistä mitään tietoa emmekä ole puhuneet kenellekään yhtiöstänne.
        </div>

        <h2>Ketkä ostaisivat</h2>
        {t.matches.length === 0 ? (
          <p className="lede">Ei osumia nykyisillä kriteereillä.</p>
        ) : (
          <>
            <p className="lede">
              Ostajakirjassamme on {t.matches.length} ostajaa, joiden toimiala- ja kokoluokkakriteerit
              täyttyvät kohdallanne
              {serial > 0 && (
                <>
                  , ja heistä <b>{serial}</b> on ostanut samalta toimialalta aiemmin
                </>
              )}
              .
            </p>
            {t.matches.map(({ buyer, why }) => (
              <div className="card" key={buyer.id}>
                <h3>{buyer.name}</h3>
                <p className="dim" style={{ margin: '0 0 8px' }}>
                  {buyer.kind} · kokoluokka {eur(buyer.minSize)} to {eur(buyer.maxSize)}
                </p>
                <p style={{ margin: '0 0 8px' }}>{why}</p>
                <p className="dim" style={{ margin: 0 }}>
                  {buyer.evidence} <i>Lähde: {buyer.source}.</i>
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

        <h2>Mitä tästä lähtisi</h2>
        <pre className="opener">
{`${c.name} rekisteröi tilinpäätöksensä ${f.registrationDate}.
Taseen loppusumma on ${eur(f.balanceProxy)} ja yhtiö on ${t.age} vuotta vanha.

Ostajakirjassamme on tällä hetkellä ${t.matches.length} ostajaa joiden kriteerit
täyttyvät ${c.industryName.toLowerCase()}-alalla tässä kokoluokassa.${
  serial > 0 ? `\n${serial === 1 ? 'Yksi heistä on' : `${serial} heistä on`} ostanut samalta toimialalta aiemmin.` : ''
}

Kerron mielelläni mitä he maksavat tämän kokoisesta yhtiöstä.
Se ei sido mihinkään.`}
        </pre>
        <p className="dim">
          Ei hintaa, ei liitettä, ei tapaamispyyntöä. Yksi tarkistettava havainto ja yksi kysymys.
        </p>

        <div className="caveat">
          <b>Rajoite auki kirjoitettuna.</b> Taseen loppusumma ei ole liikevaihto eikä käyttökate.
          Pieni suomalainen yhtiö ei ole velvollinen julkaisemaan kumpaakaan, joten luku on kokoluokan
          arvio julkisesta tilinpäätöksestä. Yritysarvoksi se tarkennetaan Mergeron omalla datalla.
        </div>
      </main>

      <footer>
        <div className="wrap">
          Kaikki luvut yhtiön omasta rekisteröidystä tilinpäätöksestä. Tarkistettavissa
          y-tunnuksella {c.businessId}.
        </div>
      </footer>
    </>
  )
}
