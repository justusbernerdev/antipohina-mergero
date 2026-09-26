# Lähteet maittain

Testattu 26.9.2026 oikeilla kutsuilla, ei luettu dokumentaatiosta. Tämä ratkaisee mitä
skaalautuvuudesta voidaan luvata ja mitä ei.

---

## Yhteenveto

| Maa | Rekisteri | Tilinpäätösvirta | Liikevaihto ja tulos | Hinta |
|---|---|---|---|---|
| **Suomi** | kyllä, 97 MB zip päivittäin | kyllä, ~50 / pankkipäivä | ei, vain tase | **0 €** |
| **Tanska** | kyllä, CVR | **kyllä, 7 069 / 3 vk** | XBRL-liitteenä | **0 €** |
| **Norja** | kyllä, REST | per yhtiö | **kyllä, suoraan JSON:ina** | **0 €** |
| **Viro** | kyllä, latausportaali | ei testattu | ei testattu | **0 €** |
| **Ruotsi** | osittain | ei avointa | ei | maksullinen |
| **Saksa** | kyllä, OffeneRegister-dumppi | ei avointa | ei | ostettava |

**Pohjoismaat ovat ilmaisia. Tämä ei ollut tiedossa kun putki rakennettiin Suomelle.**

---

## Miksi tämä on iso

Mergeron oma kalvo: *"All 18 H1 transactions had a Nordic target company. The acquirers came from
across Europe and beyond. That asymmetry is the point: origination is local, demand is global."*

Eli **Pohjoismaat eivät ole meidän valintamme vaan heidän tuotantomarkkinansa.** Kaikki kahdeksantoista
kohdetta tuli sieltä. DACH on se markkina johon he haluavat laajentua, mutta kohteet tulevat tänään
Pohjoismaista, ja koko Pohjola on katettavissa ilman että kukaan maksaa datasta euroakaan.

---

## Suomi · PRH

Toteutettu ja ajossa. `all_companies` koko rekisterinä, `all_financial_statements` virtana,
`financial` XBRL:nä. Ei avainta, ei kiintiösopimusta, CC BY 4.0.

**Rajoite:** pieni yhtiö ei julkista liikevaihtoa eikä käyttökatetta, joten kokoluokka on taseen
loppusumma. Tämä on se kohta jossa muut maat ovat Suomea parempia.

---

## Tanska · Virk / CVR

```
POST http://distribution.virk.dk/offentliggoerelser/_search
{"query":{"range":{"offentliggoerelsesTidspunkt":{"gte":"2026-09-01"}}}}
```

Avoin Elasticsearch, ei avainta. **6 433 112 tilinpäätösjulkaisua** kannassa, ja 1.–26.9.2026
välillä **7 069**. Viimeisin tulos oli julkaistu samana päivänä kello 13:15, eli virta on
reaaliaikainen.

Jokaisen julkaisun mukana tulee XBRL-dokumentti (`application/xml`) ja luettava versio.
Rakenne vastaa Suomen putkea yksi yhteen: hae ikkuna, suodata, lataa dokumentit.

**Volyymi on isompi kuin Suomessa**, mikä tarkoittaa että sama suodatus tuottaa enemmän kohteita.

---

## Norja · Brønnøysundregistrene

```
GET https://data.brreg.no/enhetsregisteret/api/enheter?naeringskode=81.210
GET https://data.brreg.no/regnskapsregisteret/regnskap/{orgnr}
```

Ei avainta. Toimialahaku palautti 6 538 siivousyhtiötä. Tilinpäätös palautuu **valmiiksi
jäsenneltynä JSON:ina**, ei XBRL:nä:

```
tilikausi     2025-01-01 to 2025-12-31
liikevaihto   6 195 877 NOK
liiketulos      302 577 NOK
tase          3 055 387 NOK
```

**Tämä on Suomea parempi ja se on merkittävää.** Norjassa saamme liikevaihdon ja liiketuloksen
suoraan, eli käyttökate on laskettavissa. Mergeron oma kriteeri on yli miljoonan dollarin
käyttökate ja yritysarvo 2 to 100 M€. **Norjassa kriteeri on testattavissa suoraan julkisesta
datasta, Suomessa vain approksimoitavissa.**

---

## Viro · Äriregister avaandmed

Latausportaali on olemassa (`avaandmed.ariregister.rik.ee`) ja aineistot ovat ilmaisia.
Tilinpäätösten saatavuutta ei ehditty testata. Viro on pieni mutta se on Prenewin esimerkkien
perusteella aktiivinen markkina, ja se on kolmas kieli nimisäännölle.

---

## Ruotsi · Bolagsverket

Avoin data on rajattua ja tilinpäätökset ovat maksullisia. Huomionarvoista: **Datasite osti
ruotsalaisen Valu8:n toukokuussa 2026** ja sen mukana 70 miljoonaa eurooppalaista yhtiötä
tilinpäätöksineen. Ruotsissa kilpaillaan siis ostettua dataa vastaan, ei tyhjää vastaan.

---

## Saksa · OffeneRegister ja Unternehmensregister

Kaupparekisteri on ladattavissa ilmaiseksi kokonaisuudessaan:

```
https://daten.offeneregister.de/de_companies_ocdata.jsonl.bz2
https://daten.offeneregister.de/openregister.db.gz
```

**Tilinpäätöksiä se ei sisällä.** DiRUG siirsi ne Bundesanzeigeristä Unternehmensregisteriin
8/2022, eikä avointa rajapintaa ole. Pääsy ostetaan (handelsregister.ai, OpenRegister) tai
kaavitaan (`bundesAPI/deutschland`).

BRIS eli EU:n rekisterien yhdyskäytävä ei auta: ei rajapintaa eikä tilinpäätöksiä.

**Eli Saksassa rekisteri on ilmainen ja ajoitussignaali ostettava.** Se on edelleen ostopäätös eikä
rakennusprojekti, mutta nyt tiedetään tarkalleen mikä osa maksaa.

---

## Mitä tästä seuraa putkelle

Lähdeadapteri ei ole tulevaisuuden suunnitelma vaan tämän hetken tarve, ja se on pienempi työ kuin
näytti:

| Osa | Vaihtuu maittain | Työmäärä |
|---|---|---|
| Rekisterin haku ja suodatus | kyllä | 1 to 2 h per maa |
| Tilinpäätösvirta | kyllä | 1 to 2 h per maa |
| Lukujen jäsennys | kyllä, Norjassa helpompi | 1 h per maa |
| Nimisääntö | **kyllä, älä aliarvioi** | 2 h per kieli |
| Pisteytys | ei | 0 |
| Ostajamatchaus | ei | 0 |
| Artefakti | vain käännös | 1 h |

Norja on helpoin: REST, JSON, luvut valmiina. Tanska on lähimpänä Suomen putkea. **Jos aika riittää
yhteen lisämaahan, se on Norja**, koska siellä voidaan näyttää heidän oma kriteerinsä toteutumassa
eikä approksimaatiota.
