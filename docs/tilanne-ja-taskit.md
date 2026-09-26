# Tilanne ja työnjako

Lauantai 26.9.2026. Deadline sunnuntai 15:00, demoslotti 15:10 alkaen, 15 minuuttia per tiimi.

---

## Mitä on lukittu

**Haaste:** Mergero. Prenew rakennetaan vain jos moottori on valmis ajoissa
([antipohina-prenew](https://github.com/justusbernerdev/antipohina-prenew)).

**Taso:** toimeksianto, ei matchaus. Matchaus on MGX eli heidän nykyinen tuotteensa.

**Kehys:** kone ei koskaan koske omistajaan. Se tuottaa yhden sivun ja yhden luonnoksen, ihminen
päättää. Tämä pitää ratkaisun yhteensopivana heidän arvonsa kanssa (*Judgment > Automation*).

**Työnjako putkessa:** engine löytää yhtiön, Selda muuttaa yhtiön ihmiseksi, Mergero käy
keskustelun. Yhteystietohakua ei rakenneta uudestaan ja se sanotaan ääneen.

---

## Mitä on olemassa

Putki ajaa päästä päähän neljässä minuutissa, nolla euroa:

```
464 319 rekisteriyksikköä
 16 389 konsolidoituva toimiala, 15 v+
    409 tilinpäätös rekisteröity ikkunassa
     80 tase yli 1,5 M€
     68 vähintään yksi ostaja täyttää kriteerit
```

Lisäksi **482 aktiivista konsolidoijaa** löydettiin rekisteristä aputoiminimien perusteella ilman
että ketään tiedettiin etukäteen.

Kaksi sivua ajossa: lista suppiloineen ja sivu per omistaja. Molemmat repossa.

---

## Backtest: läpäisi, yhdellä varauksella

**Kysymys:** olisiko kone nähnyt siivousalan kuumana ennen kuin Mergero teki PiKa × Clean-Kalle
-kaupan?

**Vastaus: kyllä, ja kahdesta suunnasta.**

| Mitä | Milloin kone olisi nähnyt sen |
|---|---|
| PiKa Puhtaus aktiivisena ostajana | **2021**, kun toinen osto eri vuonna rekisteröitiin |
| Siivousala kuumana | **ennen 2024**: 22 ostajaa, 62 kauppaa |

Clean-Kalle ostettiin 2026. Eli signaali oli olemassa kaksi to viisi vuotta ennen kauppaa.

**Erotteleeko kuumuus?** Kyllä. Kaikkiaan 551 toimialalla on vähintään yksi konsolidoija, ja
**mediaani on 7 ostajaa**. Valitut toimialat ovat kärjessä:

| Toimiala | Ostajia | Sija 551:stä |
|---|---|---|
| Tieliikenteen kuljetus | 137 | ylin 2 % |
| Kiinteistöpalvelu | 113 | ylin 4 % |
| LVI-asennus | 98 | ylin 4 % |
| Kiinteistöjen siivous | 67 | ylin 6 % |
| Maarakennus | 51 | ylin 8 % |

**Varaus joka pitää sanoa itse.** Kaikkien toimialojen kärjessä on 70200 eli liikkeenjohdon
konsultointi, 792 &rdquo;ostajaa&rdquo;. Se ei ole totta: konsulttiyhtiöt rekisteröivät brändejä,
eivät osta yhtiöitä. **Aputoiminimiheuristiikka tuottaa vääriä positiivisia juuri palvelualoilla**,
joissa yksi ihminen rekisteröi useita nimiä. Pääomavaltaisilla aloilla riski on pienempi: siivous-
tai kuljetusyritys ei rekisteröi neljää brändiä huvikseen. Siksi toimialarajaus tehdään ennen
kuumuuslaskentaa eikä sen jälkeen.

---

## Mikä on jäljellä

Kolme asiaa, ja vain ensimmäinen on koodia.

### A · Yhteystiedot ajettava kerran oikeasti
Nyt se on dokumentin lause. Yksi kohde kontaktointikerroksen läpi riittää muuttamaan sen
todisteeksi. **1 h.**

### B · Demon käsikirjoitus
Aliarvioitu ja tärkein. Materiaalia on paljon ja aikaa viisitoista minuuttia. Jos demo yrittää
näyttää kaiken, se ei näytä mitään. **3 h.**

### C · Palautus
Sähköposti Timolle ja Tatulle, repo, ja lyhyt video tai vuokaavio (erikseen suositeltu, halpa
piste). **1 h.**

**Ei rakenneta:** MCP, konsoli, Convex, API. Ne vastaavat kysymykseen &rdquo;voiko tätä
pilotoida&rdquo;, ja siihen riittää kaavio. Koodiaikaa ei kannata käyttää kerrokseen jota tuomari
ei näe ajossa.

---

## Taskit Samille

Valitse se rivi joka sopii paremmin. Molemmat ovat itsenäisiä eivätkä odota Justusta.

### Jos koodaat

**S1 · Backtest laajennettuna kaikkiin kuuteen 2026-kauppaan.** Nyt se on tehty yhdellä
(PiKa × Clean-Kalle). Toista sama viidelle muulle: Sponsor × Aminopörssi, Sponsor × SinunApteekki,
WeSports × Elite Fitness, Teqnion × Norband, No Dig × Suomen Putkisto Palvelu. Kysy jokaisesta sama
asia: **oliko ostajan ostohistoria näkyvissä rekisterissä ennen kauppaa, ja oliko toimiala
kuumimmassa kymmenyksessä?**
Data on valmiina `data/acquirers.json`. Jos neljä kuudesta läpäisee, se on numero jonka voi sanoa
lavalla. *Huom: osa kohdeyhtiöistä ei löytynyt rekisterihaulla noilla nimillä, joten ensimmäinen
työ on selvittää niiden oikeat y-tunnukset.*

**S2 · Pisteytyksen herkkyysanalyysi.** Aja `npm run build:targets` eri painoilla ja katso muuttuuko
kärki. Jos lista on sama painoilla mitä tahansa, pisteytys ei tee mitään ja se pitää tietää ennen
kuin joku kysyy. `src/lib/score.ts`, ei vaadi verkkoa, ajo kestää sekunnin.

### Jos et koodaa

**S3 · Demon käsikirjoitus, 15 minuuttia.** Tämä on tärkein yksittäinen tehtävä. Rakenne joka
kannattaa: 2 min ongelma heidän omin sanoin, 3 min yksi ketju ajossa (y-tunnus sisään, omistajan
sivu ulos), 3 min miksi se on eri asia kuin lista, 2 min miten se skaalautuu DACH:iin, 2 min mitä
pilotti vaatii, 3 min kysymykset. Materiaali: `docs/dataflow.md` ja `docs/engine.md`.

**S4 · Tarkista viisi kohdetta käsin.** Ota `data/targets.json`:sta viisi kärkiriviä ja katso
ytj.fi:stä ja yhtiön verkkosivuilta näyttävätkö ne uskottavilta. Onko yhtiö oikeasti olemassa,
näyttääkö se omistajavetoiselta, onko koko oikea. **Jos yksikin on ilmeisen väärä, se on
löydettävä nyt eikä lavalla.**

**S5 · Vastaus Gratasta.** Grata myy seller intent -signaaleja ja Datasite osti sen 2025.
Tarvitsemme yhden lauseen siitä miksi tämä on eri asia. Ehdotus: *se on tietokanta jota myydään
neuvonantajille, ei moottori joka tuottaa omistajalle esineen.* Tarkista pitääkö se paikkansa ja
kirjoita parempi jos ei.

---

## Kysymykset Timolle

Erillisessä tiedostossa: [`kysymykset-timolle.md`](kysymykset-timolle.md). Kolme tärkeintä, koska
ilman niitä puhutaan sunnuntaina arvauksin:

1. Kuinka monta omistajakeskustelua johtaa yhteen toimeksiantoon?
2. Mitä te lähetätte omistajalle ensimmäisenä, ja kuka sen lähettää?
3. Mitä MGX:n rekisteriseulonta **ei** tänään löydä?
