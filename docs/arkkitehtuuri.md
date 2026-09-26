# Miten tämä kytketään: kaikki toteutusvaihtoehdot

Moottori tuottaa 68 pisteytettyä kohdetta. Lista ilman päättäjän nimeä ei ole toimeksianto, joten
putkessa on vielä kaksi aukkoa: **yhteystieto** ja **keskustelu**. Kumpaakaan ei kannata rakentaa
uudestaan.

Työnjako jonka ympärille kaikki alla oleva rakentuu:

```
antipöhinä-moottori   kuka ja milloin        julkinen data, rakennettu tässä
Selda                 kuka vastaa ja miten   olemassa oleva, ilmoitettu
Mergero               keskustelu             heidän työnsä
```

---

## Vaihtoehto A · Push: putki työntää Seldaan

Yksi HTTP-kutsu per kohde, `selda_ingest_event`. Selda luo liidin tai tunnistaa olemassa olevan,
kirjaa tapahtuman aikajanalle ja voi liittää sen kampanjaan.

```ts
{
  type: 'signal.succession',
  source: 'antipohina-mergero',
  identity: { company: 'Lopen Maa ja Vesirakenne Oy', domain: '...' },
  analysis: '<meidän analyysimme>',   // Selda kirjoittaa TÄSTÄ, ei crawlaa uudestaan
  autoAdvance: true,                  // luonnos Brainista Sales Inboxiin
  mediaImageUrl: '<omistajan sivu kuvana>',
  idempotencyKey: '1610039-9-2026-W39',
}
```

**Mitä tämä ratkaisee.** `analysis`-kenttä on se kohta joka tekee tästä oikean: emme anna Seldalle
pelkkää nimeä ja pyydä sitä keksimään viestiä, vaan annamme valmiin havainnon ja Selda kirjoittaa
sen pohjalta. Se on sama periaate kuin koko ratkaisussa: mitään ei esitetä ilman syytä.

`autoAdvance` kirjoittaa luonnoksen, mutta **mikään ei lähde**. Luonnos jää Sales Inboxiin
odottamaan ihmisen hyväksyntää, eikä Seldassa ole parametria joka muuttaisi sen.

**Tila:** toteutettu, `scripts/export-selda.ts`. Ei ajeta demossa.

---

## Vaihtoehto B · Flow: Selda tekee työn taustalla

Tämä on se jota kysyit. `selda_create_flow` tekee Seldasta reaktiivisen: kun moottori lähettää
tapahtuman, Selda ajaa askeleet itse ilman että kukaan käynnistää mitään.

```
trigger:  inbound_event, eventTypes: ['signal.succession']
steps:
  understand   luokittele: sarjaostajakohde | rahastokohde | liian pieni | väärä toimiala
  route        ohjaa luokka omaan kampanjaansa, loput vain inboxiin
  draft_reply  kirjoita avaus Sales Inboxiin
  notify       kerro ihmiselle että se on siellä
```

**Miksi tämä on oikea muoto.** Moottori ajetaan kerran viikossa, ja se tuottaa 20 to 70 kohdetta.
Ilman flow'ta joku joutuu käsittelemään ne. Flow'n kanssa ne ovat valmiita luonnoksia kun ihminen
avaa inboxin maanantaina. **Se on täsmälleen se "scale without losing personal quality" jonka
Mergero kirjoitti haasteeksi**, ja se on ainoa kohta jossa automaatio on perusteltua: luonnoksen
kirjoittaminen, ei lähettäminen.

Flow luodaan oletuksena pois päältä. Se on hyvä, koska askeleet kannattaa lukea ennen kuin ne
päästetään oikeaan liikenteeseen.

---

## Vaihtoehto C · Webhook: Selda kertoo takaisin

`selda_create_webhook` rekisteröi osoitteen jota Selda kutsuu kun jotain tapahtuu. Tapahtumat:
`draft.ready`, `reply.received`, `lead.status_changed`, `meeting.booked`.

**Mitä tämä ratkaisee.** Se sulkee silmukan. Kun omistaja vastaa, moottori saa tietää, ja se tieto
on opetusaineistoa: *mikä signaaliyhdistelmä tuotti vastauksen*. Kolmen kuukauden jälkeen
pisteytystä ei tarvitse arvata, koska data kertoo mitkä piirteet ennustivat vastausta.

Tämä on myös suora vastaus Mergeron omaan lauseeseen kalvolla:
*"Every dialogue we capture makes the engine better at the next match. That advantage grows rather
than depreciates."* Sama ajatus, mutta origination-päässä.

**Demossa:** yksi kalvo, ei koodia. Tämä on se mitä tapahtuu kolmannessa kuukaudessa.

---

## Vaihtoehto D · MCP: Mergero kutsuu moottoria omasta cloudistaan

Me tarjoamme MCP-palvelimen, he kutsuvat sitä. Kolme työkalua riittää:

| Työkalu | Mitä tekee |
|---|---|
| `scan_market` | toimiala ja maa sisään, pisteytetyt kohteet ulos |
| `score_company` | y-tunnus sisään, signaali ja perustelu ulos |
| `match_buyers` | yhtiö ja ostajakriteerit sisään, osumat ulos |

**Miksi tämä kannattaa.** Se vastaa suoraan arvosteluperusteeseen *"Can we genuinely pilot the
solution or build on it afterwards?"* Vastaus on että heidän ei tarvitse asentaa mitään eikä
integroida mitään: he osoittavat oman assistenttinsa meidän palvelimeen ja kysyvät siltä
suomeksi ketkä omistajat ovat lähellä päätöstä.

Se on myös ainoa vaihtoehto joka **ei riipu Seldasta lainkaan**, mikä on hyvä: jos joku tuomari
epäilee että tässä myydään Seldaa, MCP on vastaus.

Koodia noin sata riviä, koska logiikka on jo `src/lib/`:ssä.

---

## Vaihtoehto E · Koko silmukka

A ja B ja C ja D yhdessä:

```
   PRH                moottori            Selda                 ihminen
 rekisteri  ──────▶  pisteytys  ──A──▶  liidi + luonnos  ────▶  hyväksyy
 virta               matchaus            (flow, taustalla)         │
 XBRL                   ▲                                          │
                        │                                          ▼
                        └──────────── C: vastaus takaisin ◀──── omistaja vastaa
                                      (pisteytys oppii)

                        ▲
                        └── D: Mergero kysyy suoraan MCP:llä
```

---

## Suositus ja järjestys

| # | Mitä | Miksi | Kesto |
|---|---|---|---|
| 1 | **Backtest** | Muuttaa väitteen todisteeksi. Ilman tätä vaikutuskriteeri jää tyhjäksi | 1 to 2 h |
| 2 | **A + B, Selda-flow** | Sulkee yhteystietoaukon ja on se "taustalla tekee" jonka Mergero pyysi | 1 h |
| 3 | **D, MCP** | Feasibility-piste, ja irrottaa demon Seldasta | 1 h |
| 4 | **C, webhook** | Yksi kalvo, ei koodia. Kertoo mitä tapahtuu kuukaudessa kolme | 10 min |

**Backtest on tärkeämpi kuin mikään kytkentä.** Aja signaali vuoden 2025 dataan ja katso nouseeko
Clean-Kalle Ab Oy listalle ennen kuin Mergero teki kaupan. Jos nousee, emme kerro heille että kone
toimii, vaan näytämme että se olisi löytänyt heidän oman kauppansa etukäteen. Sen jälkeen Selda ja
MCP ovat kirsikoita, ei perusta.

---

## Mitä demossa ajetaan

Vain vaiheet 1 ja 2: `npm run pipeline` ja sivu. **Selda ei ole mukana demossa** ja se on ilmoitettu
README:ssä hackathonin säännön mukaisesti. Se näytetään kalvolla ja sanotaan ääneen: tämä osa on
olemassa olevaa infraa, emme rakentaneet yhteystietohakua uudestaan emmekä esitä että olisimme.
