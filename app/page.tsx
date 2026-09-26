import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { loadTargets, loadFunnel, eur, pct, count } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [targets, funnel] = await Promise.all([loadTargets(), loadFunnel()])

  if (!targets.length) {
    return (
      <main className="wrap">
        <h1 style={{ marginTop: 60 }}>Aja putki ensin</h1>
        <p className="lede">
          <code>npm run pipeline</code> lataa kaupparekisterin, hakee tilinpäätösvirran ja pisteyttää
          kohteet. Ensimmäinen ajo kestää muutaman minuutin.
        </p>
      </main>
    )
  }

  const withBuyers = targets.reduce((s, t) => s + t.matches.length, 0)

  return (
    <>
      <header className="top">
        <div className="wrap">
          <span className="brand">antipöhinä × Mergero</span>
          <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            Ajo {funnel?.generatedAt} · PRH:n avoin data
            <UserButton />
          </span>
        </div>
      </header>

      <main className="wrap">
        <span className="kick">Off-market origination</span>
        <h1>Ketkä omistajat ovat juuri nyt lähellä päätöstä</h1>
        <p className="lede">
          Koko Suomen kaupparekisteri sisään, {count(targets.length)} nimettyä omistajaa ulos.
          Jokainen rivi on tarkistettavissa y-tunnuksella. Mikään alla olevasta ei ole ostettua dataa.
        </p>

        <div className="stats">
          <div className="stat">
            <b>{count(targets.length)}</b>
            <span>soitettavaa kohdetta</span>
          </div>
          <div className="stat">
            <b>{count(withBuyers)}</b>
            <span>ostajaosumaa yhteensä</span>
          </div>
          <div className="stat">
            <b>{funnel ? eur(funnel.minSize) : ''}</b>
            <span>kokoluokan alaraja</span>
          </div>
          <div className="stat">
            <b>0 €</b>
            <span>datan hankintahinta</span>
          </div>
        </div>

        {funnel && (
          <>
            <h2>Suppilo</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Vaihe</th>
                    <th>Jäljellä</th>
                    <th>Mistä</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.funnel.map((f) => (
                    <tr key={f.stage}>
                      <td>{f.stage}</td>
                      <td className="num">
                        <b>{count(f.left)}</b>
                      </td>
                      <td className="dim">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note">
              Vertailukohta: CAPTARGETin julkaistussa suppilossa 9 500 yhtiöstä 580 sopi kriteereihin
              ja 28 eteni puheluun. Ero ei ole universumin koossa vaan siinä että{' '}
              <b>soitettava lista on {count(targets.length)} eikä kuusitoistatuhatta</b>.
            </div>
          </>
        )}

        <h2>Kohteet</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Yhtiö</th>
                <th>Y-tunnus</th>
                <th>Ikä</th>
                <th>Tase</th>
                <th>Muutos</th>
                <th>Ostajia</th>
                <th>Pisteet</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.company.businessId}>
                  <td>
                    <Link href={`/kohde/${t.company.businessId}`}>
                      <b>{t.company.name}</b>
                    </Link>
                    <br />
                    <span className="dim">
                      {t.company.city
                        ? t.company.city.charAt(0) + t.company.city.slice(1).toLowerCase()
                        : ''}{' '}
                      · {t.company.industryName}
                    </span>
                  </td>
                  <td className="num">{t.company.businessId}</td>
                  <td className="num">{t.age} v</td>
                  <td className="num">{eur(t.financials.balanceProxy)}</td>
                  <td className="num">{pct(t.financials.changePct)}</td>
                  <td className="num">{t.matches.length}</td>
                  <td className="num">
                    <b>{t.score}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="caveat">
          <b>Mitä tämä lista ei ole.</b> Se ei kerro että omistaja on myymässä. Se kertoo että yhtiö
          täyttää profiilin ja että sen tilinpäätös rekisteröitiin juuri, eli omistaja on äskettäin
          katsonut omia lukujaan. Tase ei ole liikevaihto eikä käyttökate: pieni yhtiö ei julkista
          kumpaakaan, joten <b>taseen loppusumma on kokoluokan proxy</b>. Sen tarkentaminen
          yritysarvoon vaatii Mergeron omaa dataa, ja se on juuri se kohta jossa kone kytkeytyy heihin.
        </div>
      </main>

      <footer>
        <div className="wrap">
          Lähde: PRH:n avoin data, kaupparekisteri ja digitaalinen tilinpäätösvirta. Pisteytys on
          tiimin oma. Ostajakirja on koottu Mergeron julkaisemista kaupoista, ei heidän datastaan.
        </div>
      </footer>
    </>
  )
}
