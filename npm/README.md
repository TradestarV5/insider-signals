# insider-signals (TradeStar Insider — Node client)

Filing-verified U.S. insider open-market **purchase** signals, parsed straight from SEC EDGAR
Form 4 filings. This is the MIT-licensed **Node** client for the
[TradeStar Insider](https://www.tradestarinsider.com) API and MCP server. It mirrors the Python
[`insider-signals`](../) client method-for-method, so the two are consistent.

- **Website:** https://www.tradestarinsider.com
- **REST (OpenAPI 3.0.2):** https://api.tradestarinsider.com/v1/openapi.json
- **MCP server (Streamable HTTP, no auth):** `https://mcp.tradestarinsider.com/mcp`
- **Live status:** https://status.tradestarinsider.com

## What the data is

We read Form 4 filings from SEC EDGAR and keep only the open-market **buys** that carry
information — **cluster buys** (2+ insiders, same company, ≤7 days) and **large buys**
(large relative to the insider's existing holdings). Option exercises, 10b5-1 planned sales,
and sub-$50,000 noise are dropped. Every field returned is parsed from a real filing and ships
with a link to that filing on sec.gov. **Records that can't be linked to a filing are dropped,
never guessed. No scores, no unsourced numbers.** We call this Rule 2.

## What the data is *not*

It is **not a prediction.** We tested whether these two filters precede price moves over our own
history and could not find a return edge distinguishable from base rate, so we do not claim one.
This is a clean, filing-verified *lookup and verification* layer over public purchases. It is
also **not real-time**: ingestion is a once-daily weekday cron, so new filings surface **next
business day**, not live.

## Install

```bash
npm install insider-signals
```

Zero runtime dependencies — the client uses only Node built-ins (`fetch`, `AbortController`).
Requires **Node >= 18**. ESM only.

## Quickstart (free, no key)

The free tier answers on the open discovery surface with no key and per-IP rate limiting:

```js
import { InsiderSignals } from "insider-signals";

const api = new InsiderSignals();                 // public base URL, no key

console.log((await api.health()).datasets.insider); // coverage days + date range

for (const s of await api.today()) {              // today's filing-verified buys
  console.log(s.ticker, s.value_usd, s.filing_url);
}

for (const s of await api.clusters()) {           // cluster buys (2+ insiders, ≤7 days)
  console.log(s.ticker, s.cluster_insiders, s.cluster_notional);
}

// Verify a specific claim against the filings we hold:
const v = await api.verify("ETRA", "ORBIMED ADVISORS LLC");
console.log(v.status, v.count);                   // -> confirmed 2
```

See [`examples/rest_api.mjs`](examples/rest_api.mjs) for a runnable version (add `--smoke`
for a network-free self-check).

## Free tier vs. keyed tier

| Tier | Methods | Access |
|------|---------|--------|
| **Free (no key)** | `health`, `today`, `clusters`, `verify`, `verify13d`, `verify8k`, `verify13f` | Open `/public/v1`, per-IP rate limited |
| **Keyed (RapidAPI)** | `byTicker`, `byRange`, `filing`, `fundChanges`, `federalAwardsRecent`, `activistStakesRecent` | Metered, through RapidAPI |

For the keyed tier, subscribe on RapidAPI and construct the client with your key:

```js
const api = new InsiderSignals({
  baseUrl: "https://<your-rapidapi-host>",
  rapidapiKey: "...",
});
for (const s of await api.byTicker("GME")) {
  console.log(s.insider, s.shares, s.price_per_share, s.filing_url);
}
```

Calling a keyed method without a key rejects with `InsiderSignalsError` where `status === 403`.

## Method map (Node ↔ Python)

The Node client uses camelCase; the Python client uses snake_case. Everything else — routes,
parameters, response shapes — is identical.

| Node | Python | Route |
|------|--------|-------|
| `health()` | `health()` | `GET /v1/health` |
| `today()` | `today()` | `GET /public/v1/signals/today` |
| `clusters()` | `clusters()` | `GET /public/v1/signals/clusters` |
| `verify(ticker, person, amountUsd?)` | `verify(...)` | `GET /public/v1/verify` |
| `verify13d(subjectName, filerName)` | `verify_13d(...)` | `GET /public/v1/verify/13d` |
| `verify8k(cik, companyName?)` | `verify_8k(...)` | `GET /public/v1/verify/8k` |
| `verify13f(filer, issuerName, quarter)` | `verify_13f(...)` | `GET /public/v1/verify/13f` |
| `byTicker(ticker)` | `by_ticker(...)` | `GET /v1/signals/ticker/{ticker}` |
| `byRange(start, end)` | `by_range(...)` | `GET /v1/signals/range` |
| `filing(accession)` | `filing(...)` | `GET /v1/signals/filing/{accession}` |
| `fundChanges({filer?, quarter?, limit?})` | `fund_changes(...)` | `GET /v1/fund/changes` |
| `federalAwardsRecent({minAmount?, limit?})` | `federal_awards_recent(...)` | `GET /v1/usaspending/recent` |
| `activistStakesRecent({minPercent?, ticker?, limit?})` | `activist_stakes_recent(...)` | `GET /v1/activist/recent` |

Every data route returns the same envelope; the row list lives under `signals` and the client
returns that list directly for the list-returning methods. `health()` and the `verify*()` family
return the full envelope object.

## Errors

Non-2xx responses reject with `InsiderSignalsError`, which carries `.status` (the HTTP code) and
`.body` (the raw response text).

```js
import { InsiderSignals, InsiderSignalsError } from "insider-signals";

try {
  await new InsiderSignals().byTicker("GME"); // keyed route, no key -> 403
} catch (e) {
  if (e instanceof InsiderSignalsError && e.status === 403) {
    console.log("needs a RapidAPI key for the keyed tier");
  }
}
```

## License

MIT — see [LICENSE](LICENSE).
