# Insider Buy Signals

**Verify any U.S. SEC filing claim, field-by-field, against the filing it came from.** Every
figure here — shares, price, dollar value, percent, stake size — traces to a parsed field in a
real EDGAR filing and ships with a link to that filing on sec.gov. Records that can't be linked
to a filing are dropped, never guessed: no scores, no unsourced numbers. We call this filing-verified.
We also ran the obvious question — does insider buying predict returns? — as four sealed,
pre-registered tests. I tried four times to prove otherwise, and four times the data said no;
the full record is at https://www.tradestarinsider.com/what-we-tested. This repo is the
MIT-licensed MCP server, client library, and worked examples for the
[TradeStar Insider](https://www.tradestarinsider.com) API.

- **Website:** https://www.tradestarinsider.com
- **MCP server (Streamable HTTP, no auth):** `https://mcp.tradestarinsider.com/mcp`
- **REST (OpenAPI 3.0.2):** https://api.tradestarinsider.com/v1/openapi.json
- **Live status:** https://status.tradestarinsider.com
- **What we tested (negative results):** https://www.tradestarinsider.com/what-we-tested

## Run the MCP server locally

The server is published as `insider-signals-mcp` — a tiny stdio proxy to the remote endpoint.
Run it with no install using [`uvx`](https://docs.astral.sh/uv/):

```bash
uvx insider-signals-mcp
```

To wire it into **Claude Desktop**, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "insider-signals": {
      "command": "uvx",
      "args": ["insider-signals-mcp"]
    }
  }
}
```

Or point any MCP client straight at the remote endpoint (no proxy needed):
`https://mcp.tradestarinsider.com/mcp` (Streamable HTTP, no auth). The verify tools are the
core: check an insider purchase, an activist 13D stake, an 8-K event, or a 13F holding against
its source filing.

## What the data is

Five filing-verified families from SEC EDGAR (plus federal contract awards from USAspending):

- **Insider Form 4 purchases** (SEC transaction code P) — cluster buys (two or more insiders
  buying the same company inside a window of seven calendar days or fewer) and buys large
  relative to the insider's existing holdings.
- **Activist Schedule 13D stakes**, **13F fund position changes**, and **recent federal
  contract awards**.

**Code P does not by itself prove an open-market buy.** A purchase filed under P can be an
IPO / offering / private-placement allocation, so every purchase record carries an
`offering_context` flag (true = allocation, not open-market) and clusters carry a
`uniform_price_cluster` flag marking a single administered price. Option exercises, 10b5-1
planned sales, and sub-threshold noise (below $50,000) are dropped. Every field we return is
parsed from a real filing and ships with its sec.gov link. **Records that can't be linked to a
filing are dropped, never guessed. No scores, no unsourced numbers.** We call this filing-verified.

## What the data is *not*

It is **not a prediction.** We ran four pre-registered, sealed tests for whether insider buying
precedes price moves over our own history, and all four returned NULL — no return edge
distinguishable from base rate — so we do not claim one. The full record (question, method,
sample, number, verdict per test) is public at
[**What we tested**](https://www.tradestarinsider.com/what-we-tested). This is a clean,
filing-verified *lookup and verification* layer over public purchases — you decide what they mean. It is also **not real-time**: ingestion is a once-daily weekday cron, so
new filings surface **next business day**, not live.

## Coverage

- **Insider Form 4 buys:** 172 U.S. trading days, **2026-01-20 → 2026-09-23**, no gaps in the
  window (market holidays such as Presidents' Day carry no filings and are not gaps). Read the
  live number any time at [`/v1/health`](https://api.tradestarinsider.com/v1/health).
- **Completeness:** we capture **93.70%** of in-window open-market purchases (lower bound
  **87.28%**); of the filings we skip, only **0.75%** (95% CI 0.34–1.63%) turn out to be
  purchases we genuinely missed — the rest are sales, option exercises, amendments, and
  sub-$50k buys we exclude by design.

## Install

```bash
pip install insider-signals        # or, from a clone:  pip install -e .
```

Zero runtime dependencies — the client uses only the Python standard library.

## Quickstart (free, no key)

The free tier answers on the open discovery surface with no key and per-IP rate limiting:

```python
from insider_signals import InsiderSignals

api = InsiderSignals()                         # public base URL, no key

print(api.health()["datasets"]["insider"])     # coverage days + date range

for s in api.today():                          # today's filing-verified buys
    print(s["ticker"], s["value_usd"], s["filing_url"])

for s in api.clusters():                       # cluster buys (2+ insiders, ≤7 days)
    print(s["ticker"], s["cluster_insiders"], s["cluster_notional"])

# Verify a specific claim against the filings we hold:
v = api.verify("ETRA", "ORBIMED ADVISORS LLC")
print(v["status"], v["count"])                 # -> confirmed 2
```

See [`examples/rest_api.py`](examples/rest_api.py) for a runnable version.

## Free tier vs. keyed tier

| Tier | Methods | Access |
|------|---------|--------|
| **Free (no key)** | `health`, `today`, `clusters`, `verify`, `verify_13d`, `verify_8k`, `verify_13f` | Open `/public/v1`, per-IP rate limited |
| **Keyed (RapidAPI)** | `by_ticker`, `by_range`, `filing`, `fund_changes`, `federal_awards_recent`, `activist_stakes_recent` | Metered, through RapidAPI |

For the keyed tier, subscribe on RapidAPI and construct the client with your key:

```python
api = InsiderSignals(base_url="https://<your-rapidapi-host>", rapidapi_key="...")
for s in api.by_ticker("GME"):
    print(s["insider"], s["shares"], s["price_per_share"], s["filing_url"])
```

Calling a keyed method without a key raises `InsiderSignalsError` with `status == 403`.

## Worked examples — one real request and response per tool

Every response below is a real capture from the live public API (coverage as of 2026-09-23).

### `today` — today's insider buys

```http
GET https://api.tradestarinsider.com/public/v1/signals/today
```
```json
{
  "api_version": "v1",
  "endpoint": "signals/today",
  "rule2_guarantee": "Every record traces to a parsed SEC filing field and carries its source filing_url. Records without a filing link are dropped upstream and never returned.",
  "count": 0,
  "params": { "date": "2026-09-24" },
  "signals": []
}
```
_(An empty set is normal pre-market / on a non-trading day; it repopulates the moment new
filings materialize.)_

### `clusters` — cluster buys (2+ insiders, one issuer, ≤7 days)

```http
GET https://api.tradestarinsider.com/public/v1/signals/clusters
```
```json
{
  "api_version": "v1",
  "endpoint": "signals/clusters",
  "count": 1596,
  "signals": [
    {
      "filed_date": "2026-07-22",
      "ticker": "CLBK",
      "issuer_name": "Columbia Financial, Inc./MD/",
      "insider": "Splaine Thomas Jr",
      "relationship": { "director": false, "officer": true, "officer_title": "EVP, CFO" },
      "code": "P",
      "shares": 50000.0, "price_per_share": 10.0, "value_usd": 500000.0,
      "cluster": true, "cluster_insiders": 16, "cluster_notional": 4760370.0,
      "accession": "0001339736-26-000014",
      "filing_url": "https://www.sec.gov/Archives/edgar/data/2115119/000133973626000014/0001339736-26-000014-index.htm"
    }
  ]
}
```

### `verify` — confirm an insider open-market-purchase claim

```http
GET https://api.tradestarinsider.com/public/v1/verify?ticker=ETRA&person=ORBIMED ADVISORS LLC
```
```json
{
  "api_version": "v1",
  "endpoint": "verify",
  "coverage_start": "2026-01-20", "coverage_end": "2026-09-23",
  "coverage_note": "Checked SEC Form-4 open-market purchases (code P) collected 2026-01-20..2026-09-23. Absence here means not in this window — not absence at the SEC.",
  "status": "confirmed",
  "matched": ["ticker/issuer", "person"],
  "filings": [
    {
      "ticker": "ETRA", "issuer_name": "Electra Therapeutics, Inc.",
      "insider": "ORBIMED ADVISORS LLC",
      "code": "P", "shares": 1000000.0, "price_per_share": 15.0, "value_usd": 15000000.0,
      "filed_date": "2026-09-23", "accession": "0000947871-26-000880",
      "filing_url": "https://www.sec.gov/Archives/edgar/data/2088082/000094787126000880/0000947871-26-000880-index.htm"
    }
  ],
  "count": 2,
  "message": "Confirmed: 2 matching Form-4 open-market purchase filing(s)."
}
```
A claim with no matching filing returns `"status": "not_found"` (in-window) or
`"out_of_coverage"` (outside the collected days) — never a guess.

### `verify_13d` — confirm a Schedule 13D activist-stake claim

```http
GET https://api.tradestarinsider.com/public/v1/verify/13d?subject_name=New Fortress Energy Inc.&filer_name=Strategic Value Partners, LLC
```
```json
{
  "endpoint": "verify/13d",
  "coverage_start": "2026-06-22", "coverage_end": "2026-09-18",
  "status": "confirmed",
  "filings": [
    {
      "filed_date": "2026-09-18", "form_type": "SCHEDULE 13D",
      "subject_name": "New Fortress Energy Inc.", "subject_tickers": ["NFE", "NFEGP"],
      "filer_name": "Strategic Value Partners, LLC",
      "percent_of_class": 14.7, "aggregate_amount_owned": 19208710.0,
      "signal": "new_13d_bare", "stated_intent": "New 13D. No activist purpose stated.",
      "accession": "0001193125-26-395888",
      "filing_url": "https://www.sec.gov/Archives/edgar/data/1749723/0001193125-26-395888.txt"
    }
  ],
  "count": 1,
  "message": "Confirmed: 1 matching Schedule 13D/13D-A filing(s)."
}
```

### `verify_8k` — confirm an 8-K material-event claim

```http
GET https://api.tradestarinsider.com/public/v1/verify/8k?cik=1650648&company_name=4D Molecular Therapeutics, Inc.
```
```json
{
  "endpoint": "verify/8k",
  "coverage_start": "2025-03-06", "coverage_end": "2026-09-22",
  "status": "confirmed",
  "filings": [
    {
      "cik": "1650648", "company_name": "4D Molecular Therapeutics, Inc.",
      "accession": "0001193125-26-277563",
      "filing_date": "2026-06-22", "event_date": "2026-06-17", "form": "8-K",
      "items": [{ "code": "5.07", "label": "Submission of Matters to a Vote of Security Holders" }],
      "filing_url": "https://www.sec.gov/Archives/edgar/data/1650648/000119312526277563/"
    }
  ],
  "count": 4,
  "message": "Confirmed: 4 matching 8-K filing(s) carrying the claimed item(s)."
}
```

### `verify_13f` — confirm a 13F institutional-holding claim

```http
GET https://api.tradestarinsider.com/public/v1/verify/13f?filer=BERKSHIRE HATHAWAY INC&issuer_name=ALPHABET INC&quarter=2026-06-30
```
```json
{
  "endpoint": "verify/13f",
  "coverage_start": "2024-06-30", "coverage_end": "2026-06-30",
  "coverage_note": "Values are AS-OF quarter-end and up to ~45 days stale.",
  "status": "held",
  "filings": [
    {
      "filer_name": "BERKSHIRE HATHAWAY INC",
      "as_of_quarter_end": "2026-06-30", "filed_date": "2026-08-14", "lag_days": 45,
      "change": "added", "issuer_name": "ALPHABET INC", "title_of_class": "CAP STK CL A",
      "value_usd": 28157599351, "prior_value_usd": 15600071913, "ssh_prnamt": 78791167,
      "accession": "0001193125-26-352200",
      "filing_url": "https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/"
    }
  ],
  "count": 2,
  "message": "Held: 2 matching 13F position(s) reported as of the covered quarter."
}
```

## Response shape

Every *data* route returns the same envelope; the rows live under `signals`, and the client's
list-returning methods hand you that list directly. The `verify*` methods return the full
envelope (you want the `status` and `matched`/`filings` fields).

## MCP server (for AI assistants)

Ask an AI client (Claude and other MCP clients) for these signals directly. Open, free, per-IP
rate limited — no API key, no OAuth:

```bash
claude mcp add --transport http insider-signals https://mcp.tradestarinsider.com/mcp
```

Then ask: *"Show today's insider buy signals"* or *"Any insider cluster buys this week? Link the
filings."* See [`examples/mcp_client.md`](examples/mcp_client.md) for the tool list and a
programmatic SDK example.

## Pricing

| Plan | Price | Requests |
|------|-------|----------|
| Basic | $0 | 3,000 / month |
| Pro | $18 / month | 10,000 / month |
| Ultra | $58 / month | 100,000 / month |
| Mega | $100 / month | 500,000 / month |

Hard limits, no overage — requests over the cap return `429` until the window resets. The free
discovery surface and the MCP server are open and per-IP rate limited; metered API billing runs
through RapidAPI.

## Disclaimer

Information, not investment advice. Every figure is parsed from a public SEC filing and links to
its source on sec.gov. Insider buying guarantees nothing — insiders are wrong plenty — but
open-market purchases are real money on the line.

## License

[MIT](LICENSE). Changelog: [CHANGELOG.md](CHANGELOG.md).
