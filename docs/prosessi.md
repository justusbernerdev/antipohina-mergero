# Prosessi

Moottori ei ole ajo vaan rytmi. Tämä tiedosto kuvaa sen kahdella tasolla: viikko jolla se pyörii,
ja se mitä pitää tehdä kun sama kone osoitetaan uuteen asiakkaaseen tai uuteen maahan.

---

## Viikko

Lähde on virta eikä tilannekuva, joten oikea sykli on viikko. Noin 50 tilinpäätöstä rekisteröidään
pankkipäivässä, eli 250 viikossa, joista muutama kymmenen osuu kohdeprofiiliin.
**Se on oikea määrä ihmisen käsiteltäväksi**, ja se on syy miksi tämä ei ole massaoutboundia
vaikka universumi on koko maa.

| Milloin | Mitä | Kuka | Kesto |
|---|---|---|---|
| Ma 06:00 | `npm run ingest` viikon ikkunalla | kone | 4 min |
| Ma 06:10 | `npm run acquirers` jos rekisteri päivittyi | kone | 2 min |
| Ma 06:15 | `npm run build:targets` | kone | 1 s |
| Ma 06:20 | kohteet kontaktointiin, päättäjä ja luonnos | kone | 10 min |
| Ma 08:00 | **valmiit rivit perusteluineen** | — | — |
| Ma aamu | ihminen lukee, hyväksyy tai hylkää | Mergero | 30 min |
| Jatkuvasti | vastaukset takaisin pisteytykseen | kone | — |

Ainoa kohta jossa ihmisen aikaa kuluu on se puoli tuntia maanantaiaamuna. Kaikki muu on
automaattista, eikä mikään siitä koske omistajaan.

**Kausivaihtelu on todellinen eikä sitä pidä piilottaa.** 58 % tilikausista päättyy 31.12. ja
määräaika on kahdeksan kuukautta, joten kesä on sesonki ja talvi ohut. Mitattu virta: kesäkuu
1 926, heinäkuu 1 532, elokuu 1 322, syyskuu 1 112. Talvella painopiste siirtyy konsolidaatioon ja
rekisterimuutoksiin, jotka eivät noudata tilikausia.

---

## Kuukausi

| Milloin | Mitä | Miksi |
|---|---|---|
| Kuun 1. | Ostajakirjan päivitys | Uudet aputoiminimet ovat uusia yritysostoja |
| Kuun 1. | Toimialan kuumuus uudestaan | Konsolidaatio muuttuu hitaasti mutta muuttuu |
| Kuun 15. | Osumatarkkuuden katselmus | Mitkä signaalit tuottivat vastauksia, mitkä eivät |

Se viimeinen on se joka tekee tästä moottorin eikä ajon. Kolmen kuukauden jälkeen pisteytystä ei
tarvitse arvata.

---

## Uusi asiakas tai uusi maa

Viisi asiaa, ja vain kaksi niistä on koodia.

### 1. Lähde
Mistä rekisteri ja tilinpäätökset tulevat, ja mitä ne maksavat.

| Maa | Rekisteri | Tilinpäätösvirta | Hinta |
|---|---|---|---|
| Suomi | PRH avoin data | kyllä, päivittäin | **0 €** |
| Saksa | Unternehmensregister | ei avointa rajapintaa | ostettava |
| Ruotsi | Bolagsverket | ei avointa rajapintaa | ostettava |

Suomi on poikkeus. Muualla lähde on ostopäätös, ja se pitää sanoa ostopäätöksenä eikä esteenä.

### 2. Toimialat
Mitkä koodit ovat konsolidoituvia tälle asiakkaalle. Ei arvausta: **katso mitä hän on itse
ostanut.** Mergerolla se luettiin heidän julkaistuista 2026-kaupoistaan ja roll-up-caseistaan.

### 3. Kokoluokka
Mikä on ala- ja yläraja, ja millä mittarilla. Mergerolla yritysarvo 2 to 100 M€, mutta julkisesta
datasta saa vain taseen, joten rajaus tehdään proxylla ja se kirjoitetaan auki.

### 4. Nimisääntö *(koodia)*
Henkilönimen tunnistus on kielisidonnainen. Suomeksi toimii `-nen`, genetiivi ja etunimilista.
Ruotsiksi osittain, saksaksi ei lainkaan. **Jokaiseen maahan oma sääntö**, muutama tunti per maa.

### 5. Ostajakirja *(koodia, tai tiedostonvaihto)*
Joko generoidaan aputoiminimistä kuten Suomessa, tai asiakas tuo omansa. Jälkimmäinen on parempi ja
se on yksi tiedosto: toimiala, kokoluokka, maa. **Mikään muu ei muutu.**

---

## Mitä prosessi ei tee

- **Ei lähetä mitään.** Viimeinen nuoli lähtee ihmisestä. Tähän ei ole asetusta.
- **Ei päätä kenelle soitetaan.** Se tuottaa perustellun ehdotuksen ja perustelun voi kiistää.
- **Ei väitä tietävänsä että omistaja myy.** Se kertoo että hän on juuri katsonut omia lukujaan ja
  että hänen toimialallaan liikkuu ostajia.

---

## Sama kone muualla

Rakenne on riippumaton siitä että kyse on yrityskaupoista:

```
universumi julkisesta datasta
  →  suodata profiiliin
  →  pisteytä ajoitussignaalilla
  →  matchaa kysyntään
  →  tuota personoitu artefakti
  →  ihminen hyväksyy
```

Vaihda sisältö ja sama putki vastaa eri kysymykseen. Vaikuttajahaussa universumi on YouTube ja
TikTok, signaali on yleisön sitoutuminen, kysyntä on brändi. Löydettävyysanalyysissä universumi on
toimialan yritykset, signaali on hakunäkyvyyden puute, kysyntä on oma palvelu.

**Se osa joka ei vaihdu on periaate: mitään ei esitetä ilman tarkistettavaa syytä.** Jokainen rivi
kantaa perustelun, ja jokainen perustelu on jäljitettävissä lähteeseen. Se on sekä laatu- että
luottamuskysymys, ja se on ainoa syy miksi tämän kaltaisen koneen tuotos kelpaa ihmiselle joka on
nähnyt sata listaa.
