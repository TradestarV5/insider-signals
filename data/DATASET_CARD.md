---
license: mit
pretty_name: "TradeStar Insider — SEC Form 4 Open-Market Purchase Signals"
language:
  - en
task_categories:
  - tabular-classification
tags:
  - finance
  - sec-edgar
  - form-4
  - insider-trading
  - insider-signals
  - equities
size_categories:
  - 1K<n<10K
source_datasets:
  - original
---
# TradeStar Insider — SEC Form 4 Open-Market Purchase Signals (2026-10)

A monthly open snapshot of insider **open-market purchase** signals extracted from
**SEC EDGAR Form 4** filings. Every row is derived from a real, publicly filed Form 4
and links back to that exact filing on `sec.gov` via `filing_url`.

- **Snapshot month:** `2026-10`  (file: `insider-signals-2026-10.csv`)
- **Rows in this snapshot:** 26
- **Distinct tickers:** 20
- **Cluster-buy rows:** 5  (≥2 insiders in the same issuer within the window)
- **Uniform-price-cluster rows (offering/conversion tell):** 0
- **Unlisted-issuer rows (`listed_equity=false`):** 8  (blank/NONE/N/A ticker, or a 5-letter mutual-fund class — shipped here but excluded from the live signal/cluster feeds by default)
- **Total reported purchase value:** $48,539,967
- **Coverage window of the live dataset:** `2026-01-20` → `2026-10-02`
- **Cadence:** regenerated **monthly** by cron (this file is the open snapshot for `2026-10`)

## Provenance & RULE-2

Every row **traces to a real SEC filing.** The pipeline is filing-verified: a record
that cannot be linked to a live `sec.gov` `filing_url` is **dropped, never fabricated
or inferred** (this project's RULE-2). Figures in each row are parsed Form 4 fields —
we do not estimate, model, or fill missing values.

The **one measurable exception** is `uniform_price_cluster`: a deterministic
*measurement* (not an inference) flagging clusters where ≥3 distinct insiders bought
at the **identical price on the same filed date for the same issuer** — the
fingerprint of an offering/conversion (one administered price) rather than
independent open-market conviction. Form 4 transaction **code P** covers open-market
purchases *and* some offering/conversion purchases filed under P; this flag is how
the latter are marked, and such rows are ranked below genuine clusters.

## Schema

| column | meaning |
| --- | --- |
| `filed_date` | Date the Form 4 was filed (ISO `YYYY-MM-DD`). |
| `ticker` | Issuer ticker as reported (may be empty; the filing, not the ticker, is guaranteed). |
| `issuer_name` | Issuer name (standardized case). |
| `issuer_cik` | SEC Central Index Key of the issuer. |
| `insider` | Reporting person (first-last). |
| `relationship` | Reporting person's relationship to the issuer (director/officer/10% owner…). |
| `code` | Form 4 transaction code (`P` = purchase). |
| `shares` | Shares in the transaction. |
| `price_per_share` | Reported price per share. |
| `value_usd` | Reported transaction value in whole USD. |
| `shares_owned_following` | Shares owned by the insider following the transaction. |
| `increase_ratio` | Holding increase as a ratio (`0.07` = 7%, `58.0` = 58×). |
| `cluster` | `true` when part of a cluster buy (≥2 insiders, same issuer, in-window). |
| `cluster_insiders` | Distinct insiders in the cluster. |
| `cluster_notional` | Total cluster purchase value (USD). |
| `uniform_price_cluster` | `true` = offering/conversion tell (see RULE-2 exception above). |
| `listed_equity` | `true` only when the ticker resolves to an **exchange-listed common stock**; `false` for a blank/`NONE`/`N/A` ticker or a 5-letter mutual-fund class (e.g. `BBASX`). This open snapshot ships **all** rows with the flag; the live `/signals` + `/clusters` tools default to listed-only (`include_unlisted=true` to override). |
| `s2` | Large-vs-holdings flag. |
| `accession` | SEC accession number of the filing. |
| `filing_url` | **Direct `sec.gov` link to the source filing (present on every row).** |

## Usage

```python
import pandas as pd
df = pd.read_csv("insider-signals-2026-10.csv")
# Verify any row at its source filing:
print(df.loc[0, "filing_url"])
```

## Not investment advice

This dataset reports **what was filed**, not what it means. It is **not investment
advice** and carries no recommendation. Insider purchases are one public signal among
many. **Verify every row at its `filing_url`** before relying on it — the SEC filing
is the source of truth, this snapshot is a convenience projection of it.

## Changelog

- **2026-10-03 — exact-duplicate dedup (E1).** Rows are now collapsed on the unique
  `(accession, txn_index)` key: a single filed transaction line that previously
  surfaced twice (e.g. once under the reporter CIK path and once under the issuer
  CIK path, or a true same-CIK repeat) is kept **once**, with the issuer-CIK
  `filing_url` as the canonical link. Full-corpus effect of this change:
  **3,011 → 2,996 rows (−15 exact duplicate pairs removed).** Every surviving row
  still carries its `filing_url` (RULE-2 unchanged); no transaction was lost, only
  its duplicate projection.
- **2026-10-03 — same-offering sibling flagging (E2).** `offering_context` now
  propagates across sibling filings: when several insiders buy into the **same
  offering** (same issuer, same transaction date, same price) and any one filing
  carries the offering tell (an offering footnote or a same-filing convertible-
  preferred conversion), the sibling filings at that identical issuer+date+price are
  also marked `offering_context=true` with reason `"same offering, sibling filing"`.
  This closes the gap where a co-investor in the same deal looked like an independent
  open-market buyer. Full-corpus effect: **40 rows across 14 same-offering groups
  flipped `offering_context` false → true.** Before/after example: the $17.00 ADARx
  (ADRX) offering, transaction date 2026-09-28 — SR One Capital and George Simeon
  (filed 2026-09-29) were `false`, now `true` as siblings of the OrbiMed/Gordon
  filings already flagged in the same offering. No row's `filing_url` changed
  (RULE-2 unchanged).

- **2026-10-03 — listed-equity flag (E3).** Every row now carries a `listed_equity`
  boolean: `true` only for an exchange-listed common stock, `false` for an unlisted
  issuer (blank/`NONE`/`N/A` ticker, or a 5-letter mutual-fund class such as `BBASX`,
  `PMPEX`). The live signal + cluster tools now default to **listed-only**
  (`include_unlisted=true` to override); this open snapshot still ships **every** row
  so the data stays complete and self-describing. Full-corpus effect: of **2,996**
  rows, **286 are now flagged `listed_equity=false`** (2,710 listed) and are hidden
  from the default live feed. Before/after example: `BBASX` — *AMG BBH Asset-Backed
  Credit Fund, LLC* (filed 2026-09-30) previously appeared in the default signal feed;
  it is now `listed_equity=false` and excluded unless `include_unlisted=true`. No row's
  `filing_url` changed (RULE-2 unchanged); no row was dropped from the open dataset.

## License

Released under the **MIT License** (matching the TradeStar public client repo).
The underlying filings are U.S. SEC public records.
