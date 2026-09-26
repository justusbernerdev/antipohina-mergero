# Engine: mitä Mergerolle oikeasti toimitetaan

Ei paneelia johon he kirjautuvat tekemään työtä. **Moottori joka pyörii taustalla ja syöttää
heidän omaa järjestelmäänsä.** Tämä tiedosto kuvaa sen muodon.

---

## Muoto yhdellä kuvalla

```
   LÄHTEET                ENGINE                    KONTAKTOINTI             HEIDÄN
                       (rakennettu tässä)          (olemassa oleva)        JÄRJESTELMÄNSÄ

  PRH rekisteri  ──┐                              ┌──────────┐
  tilinpäätös-     ├──▶  löytö      ────────────▶ │  Selda   │ ──▶  MGX / CRM
  virta            │     pisteytys                │ päättäjä │      valmis rivi
  XBRL             │     ostajamatchaus           │ luonnos  │      perusteluineen
  rekisteri-     ──┘           │                  └──────────┘
  muutokset                    │                        │
                               ▼                        │
                        API + konsoli ◀─────────────────┘
                     avaimet · logit · preview · asetukset
```

Kolme kerrosta, kolme omistajaa:

| Kerros | Kuka omistaa | Mitä tekee |
|---|---|---|
| **Engine** | me, rakennettu hackathonissa | kuka ja milloin |
| **Kontaktointi** | Selda, olemassa oleva | kuka vastaa ja millä sanoilla |
| **Työ** | Mergero, MGX | keskustelu ja kauppa |

Mergero ei osta Seldaa eikä näe sitä. He saavat **oman moottorinsa, jonka alla Selda on
kontaktointikomponentti**. Sama suhde kuin että he eivät osta tietokantaa vaan saavat kohteita.

---

## Miksi näin eikä paneelina

Heillä on jo MGX. **Neljäs sisäänkirjautuminen on syy olla pilotoimatta**, ja se osuu suoraan
toteutettavuuskriteeriin. Heidän oma arvonsa on myös *Judgment > Automation*: moottori ei saa
vaatia heitä muuttamaan työtapojaan, se tuottaa yhden asian jota heillä ei ole ja katoaa taustalle.

Siksi lopputuote ei ole näkymä vaan **rivi heidän omassa järjestelmässään**, ja sen rivin mukana
kulkee perustelu.

---

## API

Kaikki mitä engine osaa, neljänä kutsuna. Sama pinta tarjotaan REST:inä ja MCP:nä, koska MCP:llä
heidän oma assistenttinsa osaa kysyä suoraan ilman että kukaan integroi mitään.

| Kutsu | Sisään | Ulos |
|---|---|---|
| `POST /scan` | toimiala, maa, kokoluokka, ikkuna | pisteytetyt kohteet perusteluineen |
| `GET /company/:id` | y-tunnus | signaali, luvut, perustelu, ostajaosumat |
| `POST /match` | yhtiö + ostajakriteerit | osumat ja miksi |
| `POST /deliver` | kohteet + kanava | vie Seldaan ja palauttaa heille |

`/deliver` on se kohta jossa Selda on. Se ottaa kohteen, hakee päättäjän, kirjoittaa luonnoksen
**meidän analyysistämme eikä tyhjästä**, ja palauttaa valmiin rivin heidän järjestelmäänsä.
Mikään ei lähde: luonnos odottaa ihmisen hyväksyntää.

---

## Konsoli

Kirjautuminen, mutta **ei päivittäistä työtä varten**. Neljä asiaa:

1. **Avaimet.** API-avain, sen kierrätys, mihin ympäristöön se osoittaa.
2. **Logit.** Mitä ajettiin ja milloin, montako kohdetta löytyi, mikä putosi ja miksi. Tämä on
   luottamuskysymys: kun kone ehdottaa omistajaa, heidän pitää voida nähdä millä perusteella.
3. **Preview.** Miltä rivi näyttää heidän omassa järjestelmässään ennen kuin se menee sinne.
   Tämä on ainoa kohta jossa käyttöliittymällä on myyntiarvoa: se poistaa pelon siitä mitä
   automaatti tekee heidän dataansa.
4. **Asetukset.** Toimialat, kokoluokka, maat, ajon rytmi, ja **ostajakriteerien tuonti**.

Se viimeinen on koko feasibility-argumentti. Nyt ostajakirja on julkinen sijainen, koottu heidän
omista julkaistuista kaupoistaan. Pilotissa he tuovat oman exporttinsa konsolista, **eikä mikään
muu muutu**.

---

## Rytmi

Moottori ei ole kertaluontoinen ajo vaan viikkosykli, koska lähde on virta eikä tilannekuva.

```
maanantai 06:00   viikon uudet rekisterimuutokset ja tilinpäätökset
                  pisteytys, ostajamatchaus
                  kohteet Seldaan, päättäjä + luonnos
maanantai 08:00   valmiit rivit heidän järjestelmässään
```

Noin 50 tilinpäätöstä rekisteröidään pankkipäivässä. Viikossa se on 250, joista muutama kymmenen
osuu kohdeprofiiliin. **Se on oikea määrä ihmisen käsiteltäväksi**, ja se on syy miksi tämä ei ole
massaoutboundia vaikka universumi on koko maa.

---

## Mitä vastauksen mukana palaa

Kun omistaja vastaa, Selda kertoo sen webhookilla, ja tieto menee takaisin moottoriin. Kolmen
kuukauden jälkeen pisteytystä ei tarvitse arvata: data kertoo mitkä signaaliyhdistelmät tuottivat
vastauksen.

Tämä on heidän oma lauseensa kalvolta, siirrettynä origination-päähän:

> *"Every dialogue we capture makes the engine better at the next match. That advantage grows
> rather than depreciates."*

---

## Mitä demossa näytetään

Demo ajaa vaiheet 1 ja 2 ja näyttää kaksi sivua. Sanotaan ääneen mikä on mitäkin:

- **Lista ja suppilo:** *"tämä näkymä on sitä varten että te näette mitä kone teki. Te ette
  käyttäisi tätä."*
- **Omistajan sivu:** *"tämä sen sijaan on se mitä omistaja saa."*
- **Selda:** kalvolla, ei demossa. *"Emme rakentaneet yhteystietohakua uudestaan emmekä esitä että
  olisimme. Tämä komponentti on olemassa, ja se on ilmoitettu."*
