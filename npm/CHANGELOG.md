# Changelog

All notable changes to the `insider-signals` Node client and the public API/MCP surface it
documents. Dates are UTC. This project follows [Semantic Versioning](https://semver.org).

The Node client tracks the same version line as the Python `insider-signals` client; the two
clients cover an identical API surface and ship in lockstep.

## [1.0.0] — 2026-09-28

First public release.

### Added
- Dependency-free Node client (`insider-signals`) for the TradeStar Insider REST API,
  Node built-ins only (global `fetch`, `AbortController`), ESM, Node >=18.
- Free-tier (no-key) methods on the public discovery surface: `today()`, `clusters()`,
  `verify()`, `verify13d()`, `verify8k()`, `verify13f()`, and `health()`.
- Keyed (RapidAPI) methods for the full history/query surface: `byTicker()`, `byRange()`,
  `filing()`, `federalAwardsRecent()`, `activistStakesRecent()`, `fundChanges()`.
- Method names mirror the Python `insider_signals` client (camelCase here) so the two clients
  are consistent field-for-field.
- Worked REST example (`examples/rest_api.mjs`) with a network-free `--smoke` self-check.
- MIT license.
