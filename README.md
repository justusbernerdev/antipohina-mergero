# Off-market origination engine

Prompt Marketing Hackathon 2026 · Mergero challenge · team **antipöhinä**

Mergero's own brief names the bottleneck: *"Today we identify owners and acquirers and reach out to
them by hand, one at a time, within the limits of our headcount."* Screening is not the missing
piece — MGX already screens company registers. The missing piece is **timing** and **a credible
first contact at scale**.

This repository is one chain, end to end:

```
the whole Finnish trade register  →  who is close to a succession decision  →  which buyers fit  →  what the owner receives
```

Everything it uses is public, free and checkable against a business ID.

## Run it

```bash
npm install
npm run pipeline      # ingest + score. First run downloads ~97 MB and takes a few minutes.
npm run dev           # http://localhost:3000
```

`npm run pipeline` is `ingest` followed by `build:targets`. The second one is pure computation and
re-runs in a second, so scoring can be tuned without touching PRH again.

```bash
npm run ingest -- --from 2026-06-01 --to 2026-09-26 --min-age 15
npm run build:targets -- --min-size 1500000 --limit 200
```

## How it works

### 1. The register, locally

`all_companies` is the entire Finnish trade register as one daily zip, about 97 MB compressed and
1.5 GB open. It streams through `unzip -p` and is reduced on the fly to active limited companies in
consolidating industries, at least 15 years old, excluding holding and property vehicles.

About 464,000 units in, about 16,000 out. No API key, no quota, and once downloaded the filter runs
offline.

### 2. The filing stream, as timing

`all_financial_statements` returns every digital financial statement registered in a date range.
That is not a snapshot, it is a **stream**: roughly 50 filings per working day.

A freshly registered filing is the moment an owner has just looked at their own numbers. It is the
cheapest timing signal in Finnish public data and nobody is using it for origination.

### 3. The figures, from XBRL

Each filing is fetched as raw XBRL (`/financial`). The comparative period is in the same document,
so the direction of travel costs no extra request.

We read the largest current-period figure, which in a balance sheet is the balance sheet total.
**It is a size proxy, not revenue and not EBITDA.** A Finnish micro company is not required to
publish either. That is a real limit of public data and it is labelled as such everywhere it is
shown; narrowing it to Mergero's €2–100M enterprise value band is where their own data plugs in.

### 4. Scoring

`src/lib/score.ts`. Company age, consolidating industry, fresh filing, direction of the balance
sheet, employer register status, no rebrand, outside the capital region, and a person's name in the
company name.

That last one carries more weight than it looks. *Kuljetusliike Jorma Saari Oy*,
*Metallityö H. Turunen Oy* — a company still carrying its founder's name after thirty years is
usually still owned by that family, which is the population where succession bites. Public data
cannot tell us who the owner is or how old they are; that is bought data, and it is exactly the
piece **Mergero already holds**. The engine plugs into them rather than competing with them.

### 5. Buyers, used backwards

`src/lib/buyers.ts` is a public stand-in for Mergero's 2,000 verified buyers, built from their own
published transactions and roll-up cases: Sponsor Capital, Kotera Group, Teqnion, PiKa Puhtaus,
H.I.G. Capital and others, with the sectors and sizes they have actually bought in. In a pilot the
file is replaced by their export and nothing else changes.

The matching is not the product — MGX already matches. It is pointed **the other way**. Instead of
telling a buyer what is available, it tells the **owner**: *three of the buyers we work with fit
your company, and one of them bought in your sector last year.* That sentence is not outreach, it
is information the owner cannot get anywhere else, and it is the only thing in this repo that could
not be built without the buyer side.

## What this deliberately is not

- **Not a database.** Screening is solved and Mergero already owns it.
- **Not mass outreach.** Their own values read *Discretion > Publicity*. One page per owner scales
  to thousands precisely because every page is different.
- **Not a finished product.** The brief says it need not be. This is one chain, run on real data.

## Verify it

Every row is checkable. Take a business ID from the output and look it up at
[avoindata.prh.fi](https://avoindata.prh.fi/) or ytj.fi. The figures come from the company's own
registered filing.

## Layout

```
scripts/ingest.ts        register + filing stream + XBRL  →  data/raw/
scripts/build.ts         scoring + buyer matching         →  data/targets.json, data/funnel.json
scripts/export-selda.ts  optional, not part of the demo (see below)
src/lib/prh.ts           PRH clients, retry and backoff
src/lib/xbrl.ts          minimal XBRL reader for the Finnish small-company taxonomy
src/lib/score.ts         succession scoring
src/lib/buyers.ts        buyer criteria and matching
src/lib/industries.ts    consolidating industry codes
app/                     the list, the funnel, and one page per owner
```

## Declared pre-existing infrastructure

Per the hackathon rule that existing infrastructure may sit under a pipeline as long as it is not
what gets demoed: `scripts/export-selda.ts` pushes the finished list into **Selda**, a GTM tool
owned by a team member. It is **not run in the demo** and nothing in the demo depends on it. It
exists to show the list does not die in a JSON file. It never sends a message; drafts wait for human
approval.

Everything else in this repository was written during the hackathon.

## Sources

- PRH open data: trade register, financial statement stream, XBRL filings
- Mergero: written challenge brief, opening slides, public 2026 transactions and roll-up cases
- Figures in `src/lib/buyers.ts` are from Mergero's own published material and are cited per buyer
