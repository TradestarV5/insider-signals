#!/usr/bin/env node
// Example: pull insider buy signals over the REST API with the `insider-signals` client.
//
//     npm install insider-signals
//     node examples/rest_api.mjs
//
// Everything here runs on the FREE tier — no key. The discovery surface (today, clusters,
// and the verify* family) answers on /public/v1 with per-IP rate limiting. The keyed history
// surface (byTicker, byRange, filing, fundChanges, ...) needs a RapidAPI subscription:
// construct with new InsiderSignals({ baseUrl: "<rapidapi-host>", rapidapiKey: "..." }).
//
// Run with `--smoke` to construct the client and check the method surface WITHOUT any network
// call (used by `npm test`, offline- and origin-safe).

import { InsiderSignals, InsiderSignalsError, VERSION } from "../index.js";

function printSignal(s) {
  const val = s.value_usd;
  const valS = typeof val === "number" ? `$${val.toLocaleString("en-US")}` : "?";
  const tag = s.cluster ? "cluster" : "large buy";
  console.log(
    `  ${String(s.ticker ?? "?").toUpperCase().padEnd(6)} ${valS.padStart(12)}  ` +
      `${tag.padEnd(9)}  ${s.insider ?? "?"}  ->  ` +
      `${s.filing_url ?? "(no link — should never happen)"}`,
  );
}

// Network-free self-check: verify the client constructs and exposes the full method surface.
function smoke() {
  const api = new InsiderSignals();
  const expected = [
    "health",
    "today",
    "clusters",
    "verify",
    "verify13d",
    "verify8k",
    "verify13f",
    "byTicker",
    "byRange",
    "filing",
    "fundChanges",
    "federalAwardsRecent",
    "activistStakesRecent",
  ];
  const missing = expected.filter((m) => typeof api[m] !== "function");
  if (missing.length) {
    console.error(`SMOKE FAIL: missing methods: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (api.baseUrl !== "https://api.tradestarinsider.com") {
    console.error(`SMOKE FAIL: unexpected baseUrl ${api.baseUrl}`);
    process.exit(1);
  }
  if (typeof InsiderSignalsError !== "function") {
    console.error("SMOKE FAIL: InsiderSignalsError not exported");
    process.exit(1);
  }
  console.log(
    `smoke OK — insider-signals (Node) v${VERSION}, ${expected.length} methods, no network`,
  );
}

async function main() {
  const api = new InsiderSignals(); // public base URL, no key needed for the free tier

  const h = await api.health();
  const ins = (h.datasets && h.datasets.insider) || {};
  console.log(
    `health: ${h.status ?? "?"}  coverage: ${ins.days ?? "?"} days ` +
      `${ins.earliest ?? "?"}..${ins.latest ?? "?"}`,
  );

  console.log("\n# Today's signals");
  const today = await api.today();
  if (!today.length) {
    console.log("  (no signals filed today yet — markets/filings run on business days)");
  }
  for (const s of today.slice(0, 10)) printSignal(s);

  console.log("\n# Cluster buys (2+ insiders, one company, within a 7-day window)");
  for (const s of (await api.clusters()).slice(0, 10)) printSignal(s);

  console.log("\n# Verify a specific insider open-market-purchase claim");
  const v = await api.verify("ETRA", "ORBIMED ADVISORS LLC");
  console.log(
    `  status=${v.status}  count=${v.count}  coverage ${v.coverage_start}..${v.coverage_end}`,
  );

  console.log("\n# Verify a 13D activist stake / an 8-K item / a 13F holding");
  console.log(
    "  13d:",
    (await api.verify13d("New Fortress Energy Inc.", "Strategic Value Partners, LLC")).status,
  );
  console.log("  8k :", (await api.verify8k("1650648", "4D Molecular Therapeutics, Inc.")).status);
  console.log(
    "  13f:",
    (await api.verify13f("BERKSHIRE HATHAWAY INC", "ALPHABET INC", "2026-06-30")).status,
  );
}

if (process.argv.includes("--smoke")) {
  smoke();
} else {
  main().catch((e) => {
    console.error(e instanceof InsiderSignalsError ? `API error ${e.status}` : e);
    process.exit(1);
  });
}
