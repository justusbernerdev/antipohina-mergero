# Originaatio

Off-market origination for M&A, running on public company registers.

**Live: [mergero.justusberner.com](https://mergero.justusberner.com)**
· API and MCP: `https://notable-kingfisher-744.eu-west-1.convex.site`
· Suomeksi: [docs/LUEMINUT.md](docs/LUEMINUT.md)

Mergero's brief names the bottleneck itself: origination is relationship-driven, and that is what
limits how fast it scales. Screening is not the missing piece, they already do that. The missing
pieces are **timing** and **a first contact that says something the owner could not get anywhere
else**.

This is one chain, running:

```
the trade registers of two countries  →  who just filed  →  who fits the buyer book  →  what an advisor needs to know
```

Everything it reads is public, free, and checkable against a business ID in under a minute.

## What is actually running

A run takes two to four minutes and costs nothing.

| | Register | After filter | Filed in window | Passed size | With a buyer |
|---|---|---|---|---|---|
| **Finland** `43*` `81*` | 14 683 | 7 094 | 93 | 9 | 9 |
| **Norway** `43*` `81*` | 6 206 | 5 060 | 5 060 | 360 | 145 |

Countries run as concurrent lanes and each writes its counters as it goes, so the diagram fills
while the engine is still working. Targets are written as each country finishes, not all at once at
the end.

**Finland's yield is thin and there is a reason.** Digital filing coverage is small, so of 14 683
register units only 93 filed inside the window. Norway carries the volume. That is why there are
two countries rather than one.

## Three ways in, one engine behind them

**The page.** [mergero.justusberner.com](https://mergero.justusberner.com) — pick countries,
industries, age, size floor and filing window, press run, watch it fill. The criteria panel shows
the exact JSON that `POST /v1/runs` receives, so a client can read it on screen and send it from
their own system. **Sign-in required**, and registration is open to anyone for now.

**REST.**

```bash
curl -X POST https://notable-kingfisher-744.eu-west-1.convex.site/v1/runs \
  -H 'authorization: Bearer <key>' \
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

**MCP.** Four tools, over Streamable HTTP at `/mcp`:

```bash
claude mcp add --transport http originaatio \
  https://notable-kingfisher-744.eu-west-1.convex.site/mcp \
  --header "Authorization: Bearer <key>"
```

| Tool | What it does |
|---|---|
| `start_run` | criteria in, run id back immediately |
| `get_run` | stage counts and per-country lanes, poll until `done` |
| `get_targets` | the scored owners, highest first |
| `explain` | one company: every figure with its basis, the buyers with their evidence, and what public data cannot tell you |

`start_run` returns at once rather than blocking, because a run takes minutes and an agent waiting
four of them is an agent that has timed out.

## How it works

### The register, filtered on the server

The first version of this downloaded the whole Finnish register as a 97 MB daily zip and filtered
it locally. That works on a laptop and is impossible inside a function. PRH's v3 company endpoint
filters server-side — industry, company form and registration date all go in the query — so the
same population arrives as a few hundred pages of JSON. **That one change is what let the engine
move onto a platform.**

### The filing stream, as timing

A freshly registered financial statement is the moment an owner has just looked at their own
numbers. It is the cheapest timing signal in Finnish public data and nobody uses it for
origination. Roughly fifty filings are registered per banking day.

**Filing late is the stronger signal.** Every company files every year, so the filing itself marks
a moment rather than a situation. Missing the statutory eight-month deadline means something is
going on: an owner whose attention is elsewhere, an accountant mid-change, a year nobody wanted to
close.

### Scoring ranks, it does not filter

Nobody drops at the scoring stage. Age, consolidating industry, fresh filing, direction of travel,
employer register, no rebrand, outside the capital region, and a person's name in the company name.

That last one carries more than it looks. *Kuljetusliike Jorma Saari Oy*, *Metallityö H. Turunen
Oy* — a company still carrying its founder's name after thirty years is usually still owned by that
family, which is the population where succession bites. Public data cannot say who owns a company;
that is bought data, and it is exactly the piece **Mergero already holds**.

### The buyer book, used backwards

Matching is not the product, MGX already matches. It is pointed the other way. Instead of telling a
buyer what is available, it tells the **owner**: three of the buyers we work with fit your company,
and one of them bought in your sector last year. That is not outreach, it is information the owner
cannot get anywhere else, and it is the only thing here that could not be built without the buyer
side.

### Findings, not a ready-made message

An earlier version wrote the opening email. That was wrong twice over: it put words in an advisor's
mouth, and because it had to read fluently it quietly asserted things the data did not support — it
told a Norwegian owner their filing had just been registered, when the only date Norway publishes
is the end of the financial period.

What comes out now is structured: every figure with the basis it rests on, every scoring reason
with its points, the buyers with their public evidence, **what public data cannot tell you here**,
and the questions still open. What to say to the owner is the advisor's to write.

## Every country is a different process

Not a parameter. The differences are real and they are where the work is.

| | Finland | Norway |
|---|---|---|
| Industry code | TOL `43210` | **`43.21`** — the fifth digit differs, and the five-digit code returns nothing, silently |
| Timing signal | dated filing stream | no stream; the last financial year filed |
| Size measure | balance sheet total, a proxy | **revenue, published directly** |
| Comparative period | yes, same XBRL document | no, one period at a time |
| Extra | auxiliary trade names reveal who is acquiring | `erIKonsern` says whether it has already been bought |

Norway does not get Finland's "filed just now" points, because that is a fact we do not know there.

## Coverage, checked rather than assumed

Seven countries, every claim made with a real call on 27.9.2026. The Countries tab shows the
endpoint that produced each one.

| | Register | Price | Status |
|---|---|---|---|
| **Finland** | PRH | €0, CC BY 4.0, no key | running |
| **Norway** | Brønnøysund | €0, NLOD 2.0, no key | running |
| **Denmark** | Erhvervsstyrelsen | stream and figures €0, industry needs a CVR credential | built, not offered |
| **Estonia** | e-Äriregister | €0 | mapped |
| **UK** | Companies House | €0 with a free key | mapped |
| **Sweden** | Bolagsverket | filings are paid | purchase |
| **Germany** | OffeneRegister | register €0, filings paid | purchase |

**Denmark is built and tested** (`convex/sources/dk.ts`): the stream returned 4 102 publications in
two weeks and the filing gives the name, founding date, domicile, the balance sheet for both
periods and the profit. The industry code is not in the filing, and the free CVR lookup ran out of
quota inside one run. Without an industry there is no buyer matching, so the country is not offered
until a credential is obtained. A form, not a build.

**The cost structure inverts.** In Finland the timing signal is free and owner data must be bought.
In Germany the register and the company officers are free and the filings are what you pay for.
Germany is Mergero's target market, so knowing which half costs money turns it from a build into a
purchase decision.

## The contact layer is called, not rebuilt

The engine stops at *this company, and here is why*. Turning a company into a person is a different
problem that is already solved, so a lead is handed to **Selda** over its MCP endpoint with the
analysis attached — which is what stops it crawling a website and inventing an angle. Selda finds
the decision maker and drafts the opening; the draft waits for a human inside Selda.

Nothing in this repository sends anything to anyone, and there is no parameter on either side that
changes that. Every target carries `status: awaiting_human`.

## What is protected, and by what

| | Lock |
|---|---|
| `/` and `/dataflow` | Clerk in the browser **and** the Clerk token verified inside Convex |
| `/kohde/{id}` | public, by design |
| `/v1/*` and `/mcp` | bearer key |

A browser session and a machine key are different problems and neither stands in for the other. The
middleware gate was not enough on its own: without Convex checking the token, anyone holding the
deployment URL could call the same functions the signed-in page calls.

## Layout

```
convex/schema.ts        runs, targets, keys
convex/pipeline.ts      the engine, one action, countries as concurrent lanes
convex/sources/         fi.ts · no.ts · dk.ts, one adapter per register
convex/lib/             scoring, buyer book, XBRL reader, analysis, criteria
convex/http.ts          REST and MCP, same engine behind two doors
convex/mcp.ts           four tools
convex/selda.ts         hand a lead to the contact layer, read back what it made of it
app/dataflow/           the diagram, the engine feed, coverage, connection guides
app/kohde/[bid]/        one page about the owner's own company, public by design
```

## Running it yourself

```bash
npm install
npx convex dev          # provisions a deployment and pushes the functions
npm run dev             # http://localhost:3000/dataflow
```

Mint an API key with `npx convex run keys:create '{"label":"Mergero"}'`. Until one exists the API
is open, and `GET /v1/health` says so — a security posture nobody can see is not one.

Secrets belong to the deployment, never the repository:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<instance>.clerk.accounts.dev
npx convex env set SELDA_KEY sk_live_...
npx convex env set SELDA_PROJECT <projectId>
```

## Verify it

Take any business ID from the output and look it up at [ytj.fi](https://tietopalvelu.ytj.fi) or
[brreg.no](https://virksomhet.brreg.no). Every figure comes from the company's own registered
filing. Each target carries the register link that proves it.

## Sources

PRH open data (trade register, filing stream, XBRL) · Brønnøysundregistrene (Enhetsregisteret,
Regnskapsregisteret) · Erhvervsstyrelsen (Virk) · Mergero's written brief, opening slides and
published 2026 transactions. Figures in `convex/lib/buyers.ts` come from Mergero's own published
material and are cited per buyer.
