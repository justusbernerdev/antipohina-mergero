# Originaatio

Off-market-originaatio M&A:han, ajossa julkisilla kaupparekistereillä.

**Livenä: [mergero.justusberner.com](https://mergero.justusberner.com)**
· API ja MCP: `https://notable-kingfisher-744.eu-west-1.convex.site`
· English: [README.md](../README.md)

Mergeron oma brief nimeää pullonkaulan: originaatio on suhdevetoista, ja juuri se rajoittaa kuinka
nopeasti se skaalautuu. Seulonta ei ole puuttuva pala, sen he tekevät jo. Puuttuvat palat ovat
**ajoitus** ja **ensimmäinen kontakti joka kertoo omistajalle jotain mitä hän ei saa mistään
muualta**.

Tämä on yksi ketju, ajossa:

```
kahden maan kaupparekisterit  →  kuka jätti juuri tilinpäätöksen  →  kenelle ostajakirja sopii  →  mitä neuvonantajan pitää tietää
```

Kaikki mitä se lukee on julkista, ilmaista ja tarkistettavissa y-tunnuksella alle minuutissa.

## Mitä on oikeasti ajossa

Ajo kestää kaksi to neljä minuuttia eikä maksa mitään.

| | Rekisteri | Suodatuksen jälkeen | Tilinpäätös ikkunassa | Kokoluokka | Ostajaosuma |
|---|---|---|---|---|---|
| **Suomi** `43*` `81*` | 14 683 | 7 094 | 93 | 9 | 9 |
| **Norja** `43*` `81*` | 6 206 | 5 060 | 5 060 | 360 | 145 |

Maat ajavat rinnakkaisina kaistoina ja kumpikin kirjoittaa laskurinsa sitä mukaa kuin etenee, joten
kaavio täyttyy moottorin vielä työskennellessä. Kohteet kirjoitetaan kun maa valmistuu, ei vasta
lopussa.

**Suomen sato on ohut ja siihen on syy.** Digitaalisen tilinpäätöksen kattavuus on pieni, joten
14 683 rekisteriyksiköstä vain 93 jätti tilinpäätöksen ikkunassa. Norja kantaa volyymin. Tämä on
syy miksi maita on kaksi eikä yksi.

## Kolme sisäänkäyntiä, yksi moottori

### Sivu

[mergero.justusberner.com](https://mergero.justusberner.com) · valitse maat, toimialat, ikä,
kokoraja ja tilinpäätösikkuna, paina aja, katso täyttymistä. Kriteeripaneeli näyttää täsmälleen sen
JSONin jonka `POST /v1/runs` vastaanottaa, joten asiakas lukee sen ruudulta ja lähettää omasta
järjestelmästään.

**Kirjautuminen vaaditaan.** Moottori ja sen löydöt ovat lista nimettyjä yksityisiä yhtiöitä
perusteluineen. Rekisteröityminen on toistaiseksi auki kaikille.

### REST

```bash
curl -X POST https://notable-kingfisher-744.eu-west-1.convex.site/v1/runs \
  -H 'authorization: Bearer <avain>' \
  -H 'content-type: application/json' -d '{
  "countries": ["FI", "NO"],
  "industries": ["43*", "81*"],
  "minAgeYears": 15,
  "minSize": { "FI": 1500000, "NO": 15000000 },
  "filingWindowDays": 70,
  "limit": 200
}'
# 202 Accepted → { "run_id": "...", "poll": "/v1/runs/..." }
```

`GET /v1/health` · `GET /v1/runs` · `GET /v1/runs/{id}` · `GET /v1/runs/{id}/targets`

Avain luodaan kerran per järjestelmä: `npx convex run keys:create '{"label":"Mergero"}'`.
Ennen ensimmäistä avainta rajapinta on auki, ja `GET /v1/health` kertoo sen ääneen. Turvataso jota
kukaan ei näe ei ole turvataso.

### MCP

```bash
claude mcp add --transport http originaatio \
  https://notable-kingfisher-744.eu-west-1.convex.site/mcp \
  --header "Authorization: Bearer <avain>"
```

| Työkalu | Mitä tekee |
|---|---|
| `start_run` | kriteerit sisään, ajon tunnus heti takaisin |
| `get_run` | vaiheiden luvut ja maakohtaiset kaistat, kysy kunnes `done` |
| `get_targets` | pisteytetyt omistajat, korkein ensin |
| `explain` | yksi yhtiö: jokainen luku perusteineen, ostajat julkisine todisteineen, ja mitä julkinen data ei kerro |

`start_run` palaa heti eikä jää odottamaan, koska ajo kestää minuutteja ja agentti joka odottaa
neljä niistä on agentti joka on aikakatkaistu.

## Miten se toimii

### Rekisteri, suodatettuna palvelimella

Ensimmäinen versio latasi koko Suomen rekisterin 97 MB:n päivittäisenä zippinä ja suodatti
paikallisesti. Se toimii läppärillä ja on mahdotonta funktion sisällä. PRH:n v3-yhtiöpäätepiste
suodattaa palvelinpuolella: toimiala, yhtiömuoto ja rekisteröintipäivä menevät kaikki kyselyyn,
joten sama populaatio saapuu muutamana satana sivuna JSONia. **Tuo yksi muutos on se joka siirsi
moottorin alustalle.**

### Tilinpäätösvirta ajoituksena

Tuoreeltaan rekisteröity tilinpäätös on hetki jolloin omistaja on juuri katsonut omia lukujaan. Se
on halvin ajoitussignaali suomalaisessa julkisessa datassa, eikä kukaan käytä sitä originaatioon.
Noin viisikymmentä tilinpäätöstä rekisteröidään pankkipäivässä.

**Myöhässä jättäminen on vahvempi signaali.** Jokainen yhtiö jättää tilinpäätöksen joka vuosi, joten
jättäminen itsessään merkitsee hetkeä eikä tilannetta. Kahdeksan kuukauden määräajan ylittäminen
tarkoittaa että jotain on kesken: omistaja jonka huomio on muualla, kirjanpitäjä vaihtumassa, vuosi
jota kukaan ei halunnut sulkea.

### Pisteytys järjestää, ei seulo

Tässä vaiheessa ei putoa kukaan. Ikä, konsolidoituva toimiala, tuore tilinpäätös, kehityssuunta,
työnantajarekisteri, ei nimenmuutoksia, pääkaupunkiseudun ulkopuolella, ja henkilönimi yhtiön
nimessä.

Viimeinen kantaa enemmän kuin miltä näyttää. *Kuljetusliike Jorma Saari Oy*, *Metallityö H. Turunen
Oy* · yhtiö joka kantaa perustajansa nimeä kolmenkymmenen vuoden jälkeen on yleensä yhä saman
perheen omistuksessa, ja se on se populaatio jossa sukupolvenvaihdos puree. Julkinen data ei kerro
kuka omistaa; se on ostettua dataa, ja juuri se pala **on Mergerolla jo hallussaan**.

### Ostajakirja, käytettynä väärinpäin

Matchaus ei ole tuote, MGX matchaa jo. Se on käännetty toisin päin. Sen sijaan että kerrottaisiin
ostajalle mitä on tarjolla, kerrotaan **omistajalle**: kolme ostajaa joiden kanssa työskentelemme
sopii yhtiöösi, ja yksi heistä osti samalta toimialalta viime vuonna. Se ei ole outboundia, se on
tietoa jota omistaja ei saa mistään muualta, ja se on ainoa asia tässä jota ei voisi rakentaa ilman
ostajapuolta.

### Havaintoja, ei valmista viestiä

Aikaisempi versio kirjoitti avausviestin. Se oli väärin kahdesti: se pani sanat neuvonantajan
suuhun, ja koska sen piti lukea sujuvasti, se väitti hiljaa asioita joita data ei tue. Se kertoi
norjalaiselle omistajalle että tilinpäätös rekisteröitiin juuri, vaikka ainoa päivämäärä jonka
Norja julkaisee on tilikauden päättymispäivä.

Ulos tulee nyt jäsenneltyä: jokainen luku perusteineen, jokainen pisteytyssyy pisteineen, ostajat
julkisine todisteineen, **mitä julkinen data ei kerro tässä**, ja auki olevat kysymykset. Mitä
omistajalle sanotaan on neuvonantajan kirjoitettava.

## Jokainen maa on eri prosessi

Ei parametri. Erot ovat todellisia ja niissä on se työ.

| | Suomi | Norja |
|---|---|---|
| Toimialakoodi | TOL `43210` | **`43.21`** · viides numero eroaa, ja viisinumeroinen palauttaa nollan hiljaa |
| Ajoitussignaali | päivätty tilinpäätösvirta | ei virtaa; viimeisin jätetty tilikausi |
| Kokomitta | taseen loppusumma, proxy | **liikevaihto, julkaistaan suoraan** |
| Vertailukausi | kyllä, samassa XBRL-dokumentissa | ei, yksi kausi kerrallaan |
| Ekstra | aputoiminimet paljastavat kuka ostaa | `erIKonsern` kertoo onko jo ostettu |

Norja ei saa Suomen "rekisteröity juuri" -pisteitä, koska se on fakta jota siellä ei tiedetä.

## Kattavuus, tarkistettuna eikä oletettuna

Seitsemän maata, jokainen väite tehty oikealla kutsulla 27.9.2026. Maat-välilehti näyttää sen
päätepisteen joka tuotti kunkin väitteen.

| | Rekisteri | Hinta | Tila |
|---|---|---|---|
| **Suomi** | PRH | 0 €, CC BY 4.0, ei avainta | ajossa |
| **Norja** | Brønnøysund | 0 €, NLOD 2.0, ei avainta | ajossa |
| **Tanska** | Erhvervsstyrelsen | virta ja luvut 0 €, toimiala vaatii CVR-tunnuksen | rakennettu, ei tarjolla |
| **Viro** | e-Äriregister | 0 € | kartoitettu |
| **Britannia** | Companies House | 0 € ilmaisella avaimella | kartoitettu |
| **Ruotsi** | Bolagsverket | tilinpäätökset maksullisia | ostopäätös |
| **Saksa** | OffeneRegister | rekisteri 0 €, tilinpäätökset maksullisia | ostopäätös |

**Tanska on rakennettu ja ajettu** (`convex/sources/dk.ts`): virta palautti 4 102 julkaisua
kahdessa viikossa, ja tilinpäätös antaa nimen, perustamispäivän, kotipaikan, taseen molemmilta
kausilta ja tuloksen. Toimialakoodi ei ole tilinpäätöksessä, ja ilmainen CVR-haku loppui kesken
yhden ajon. Ilman toimialaa ei ole ostajamatchausta, joten maata ei tarjota ennen kuin tunnus on
haettu. Lomake, ei rakennusprojekti.

**Kustannusrakenne kääntyy ympäri.** Suomessa ajoitussignaali on ilmainen ja omistajatieto
ostettava. Saksassa rekisteri ja vastuuhenkilöt ovat ilmaisia ja tilinpäätöksistä maksetaan. Saksa
on Mergeron tavoitemarkkina, joten sen tietäminen kumpi puolisko maksaa muuttaa asian
rakennusprojektista ostopäätökseksi.

## Kontaktointikerros kutsutaan, ei rakenneta uudestaan

Moottori päättyy siihen: *tämä yhtiö, ja tässä miksi*. Yhtiön muuttaminen ihmiseksi on eri ongelma
joka on jo ratkaistu, joten liidi luovutetaan **Seldalle** sen MCP-päätepisteen yli analyysi
mukana, ja juuri se estää sitä kaapimasta verkkosivua ja keksimästä kulmaa. Selda löytää päättäjän
ja kirjoittaa avauksen; luonnos odottaa ihmistä Seldan sisällä.

Mikään tässä repossa ei lähetä mitään kenellekään, eikä kummallakaan puolella ole parametria joka
sen muuttaisi. Jokainen kohde kantaa tilaa `awaiting_human`.

## Suojaus

| | Suoja |
|---|---|
| `/` ja `/dataflow` | Clerk-kirjautuminen selaimessa **ja** Clerkin token tarkistettuna Convexissa |
| `/kohde/{tunnus}` | julkinen, tarkoituksella |
| `/v1/*` ja `/mcp` | bearer-avain |

Selain-sessio ja kone-avain ovat eri ongelmia eikä kumpikaan korvaa toista. Middlewaren portti ei
riittänyt yksin: ilman Convexin omaa tarkistusta kuka tahansa deployment-osoitteen haltija olisi
voinut kutsua samoja funktioita kuin kirjautunut sivu.

## Rakenne

```
convex/schema.ts        ajot, kohteet, avaimet
convex/pipeline.ts      moottori, yksi action, maat rinnakkaisina kaistoina
convex/sources/         fi.ts · no.ts · dk.ts, yksi adapteri per rekisteri
convex/lib/             pisteytys, ostajakirja, XBRL-lukija, analyysi, kriteerit
convex/http.ts          REST ja MCP, sama moottori kahden oven takana
convex/mcp.ts           neljä työkalua
convex/selda.ts         liidin luovutus kontaktointikerrokselle ja vastauksen luku
app/dataflow/           kaavio, moottorisyöte, kattavuus, kytkentäohjeet
app/kohde/[bid]/        yksi sivu omistajan omasta yhtiöstä, julkinen tarkoituksella
```

## Ajaminen itse

```bash
npm install
npx convex dev          # luo deploymentin ja vie funktiot
npm run dev             # http://localhost:3000/dataflow
```

Ympäristömuuttujat deploymentiin, ei koskaan repoon:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<instanssi>.clerk.accounts.dev
npx convex env set SELDA_KEY sk_live_...
npx convex env set SELDA_PROJECT <projectId>
```

## Tarkista se

Ota mikä tahansa y-tunnus tuloksista ja katso [ytj.fi](https://tietopalvelu.ytj.fi) tai
[brreg.no](https://virksomhet.brreg.no). Jokainen luku tulee yhtiön omasta rekisteröidystä
tilinpäätöksestä. Jokainen kohde kantaa rekisterilinkin joka todistaa sen.

## Mitä tämä ei ole

- **Ei tietokanta.** Seulonta on ratkaistu ja Mergero omistaa sen jo.
- **Ei massaoutboundia.** Heidän oma arvonsa on *Discretion > Publicity*. Yksi sivu per omistaja
  skaalautuu tuhansiin juuri siksi että jokainen sivu on eri.
- **Ei valmis tuote.** Brief sanoo ettei sen tarvitse olla. Tämä on yksi ketju, ajettuna oikealla
  datalla, alustalla jolle voi kirjautua.

## Lähteet

PRH:n avoin data (kaupparekisteri, tilinpäätösvirta, XBRL) · Brønnøysundregistrene
(Enhetsregisteret, Regnskapsregisteret) · Erhvervsstyrelsen (Virk) · Mergeron kirjallinen brief,
avauskalvot ja julkaistut 2026-transaktiot. Luvut tiedostossa `convex/lib/buyers.ts` ovat Mergeron
omasta julkaistusta materiaalista ja on merkitty lähteittäin ostajakohtaisesti.
