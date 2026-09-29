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
# TradeStar Insider — SEC Form 4 Open-Market Purchase Signals (2026-09)

A monthly open snapshot of insider **open-market purchase** signals extracted from
**SEC EDGAR Form 4** filings. Every row is derived from a real, publicly filed Form 4
and links back to that exact filing on `sec.gov` via `filing_url`.

- **Snapshot month:** `2026-09`  (file: `insider-signals-2026-09.csv`)
- **Rows in this snapshot:** 283
- **Distinct tickers:** 134
- **Cluster-buy rows:** 91  (≥2 insiders in the same issuer within the window)
- **Uniform-price-cluster rows (offering/conversion tell):** 36
- **Total reported purchase value:** $731,247,486
- **Coverage window of the live dataset:** `2026-01-20` → `2026-09-25`
- **Cadence:** regenerated **monthly** by cron (this file is the open snapshot for `2026-09`)

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
| `s2` | Large-vs-holdings flag. |
| `accession` | SEC accession number of the filing. |
| `filing_url` | **Direct `sec.gov` link to the source filing (present on every row).** |

## Usage

```python
import pandas as pd
df = pd.read_csv("insider-signals-2026-09.csv")
# Verify any row at its source filing:
print(df.loc[0, "filing_url"])
```

## Not investment advice

This dataset reports **what was filed**, not what it means. It is **not investment
advice** and carries no recommendation. Insider purchases are one public signal among
many. **Verify every row at its `filing_url`** before relying on it — the SEC filing
is the source of truth, this snapshot is a convenience projection of it.

## License

Released under the **MIT License** (matching the TradeStar public client repo).
The underlying filings are U.S. SEC public records.
