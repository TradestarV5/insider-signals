# Changelog

All notable changes to the `insider-signals` client and the public API/MCP surface it
documents. Dates are UTC. This project follows [Semantic Versioning](https://semver.org).

## [1.0.0] — 2026-09-28

First public release.

### Added
- Dependency-free Python client (`insider_signals`) for the TradeStar Insider REST API,
  standard library only.
- Free-tier (no-key) methods on the public discovery surface: `today()`, `clusters()`,
  `verify()`, `verify_13d()`, `verify_8k()`, `verify_13f()`, and `health()`.
- Keyed (RapidAPI) methods for the full history/query surface: `by_ticker()`, `by_range()`,
  `filing()`, `federal_awards_recent()`, `activist_stakes_recent()`, `fund_changes()`.
- Worked REST examples (`examples/rest_api.py`) and an MCP client guide
  (`examples/mcp_client.md`), each with a real request and response.
- MIT license.

### Data surface at release
- **Insider Form 4 buys:** 172 U.S. trading days, 2026-01-20 → 2026-09-23, no gaps in the
  window. Source: live `/v1/health`.
- **Coverage completeness:** 93.70% code-P recall (lower bound 87.28%); 0.75% genuine-gap
  rate (95% CI [0.34%, 1.63%]). Source: `PQ-2` coverage study.
- **Freshness:** next-business-day (once-daily weekday ingestion, not real-time). A precise
  median-latency figure is being restated from a larger sample and will land in a following
  release.

### Notes
- This is a lookup/verification layer over public SEC filings. It makes **no return
  prediction** — a study over our own history could not distinguish a return edge from base
  rate, so we do not claim one.
