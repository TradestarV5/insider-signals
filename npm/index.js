// Insider Buy Signals — a tiny, dependency-free Node client for the TradeStar Insider API.
//
// Filing-verified U.S. insider open-market purchase signals from SEC EDGAR Form 4. Every field
// returned traces to a parsed field in a real filing and carries its `filing_url` on sec.gov
// (the service's "Rule 2"); records that can't be linked to a filing are dropped, never guessed.
//
//     import { InsiderSignals } from "insider-signals";
//
//     const api = new InsiderSignals();          // defaults to the public base URL, no key
//     for (const s of await api.today()) {        // free tier: today, clusters, verify*
//       console.log(s.ticker, s.value_usd, s.filing_url);
//     }
//
// Two tiers, one client:
//
// - Free (no key): today(), clusters(), and the verify*() family answer on the open
//   `/public/v1` discovery surface with no key and per-IP rate limiting.
// - Keyed (RapidAPI): the full history/query surface — byTicker(), byRange(), filing(),
//   federalAwardsRecent(), activistStakesRecent(), fundChanges() — is metered through RapidAPI.
//   Pass `rapidapiKey` and point `baseUrl` at your RapidAPI host. Calling a keyed method
//   without a key returns HTTP 403 (InsiderSignalsError).
//
// The REST contract is OpenAPI 3.0.2 at {BASE}/v1/openapi.json. This client uses only Node
// built-ins (global fetch, Node >=18), so it has no install dependencies and doubles as a
// readable reference. Method names mirror the Python `insider_signals` client (camelCase here).

export const VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://api.tradestarinsider.com";

/** Raised on a non-2xx API response. `status` and `body` hold the HTTP detail. */
export class InsiderSignalsError extends Error {
  constructor(status, body) {
    super(`API error ${status}: ${String(body).slice(0, 300)}`);
    this.name = "InsiderSignalsError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Client for the Insider Buy Signals REST API.
 *
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]     API base (default the public host). Point at a RapidAPI
 *                                     gateway host if you subscribe through RapidAPI.
 * @param {string} [opts.rapidapiKey] Optional RapidAPI key; when set, X-RapidAPI-Key /
 *                                     X-RapidAPI-Host headers are attached to every request.
 * @param {string} [opts.rapidapiHost] Optional RapidAPI host override (defaults to baseUrl host).
 * @param {number} [opts.timeout]     Per-request timeout in ms (default 30000).
 */
export class InsiderSignals {
  constructor(opts = {}) {
    const {
      baseUrl = DEFAULT_BASE_URL,
      rapidapiKey = null,
      rapidapiHost = null,
      timeout = 30000,
    } = opts;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.rapidapiKey = rapidapiKey;
    this.rapidapiHost = rapidapiHost || new URL(this.baseUrl).host;
    this.timeout = timeout;
  }

  // --- low-level ---------------------------------------------------------
  async _get(path, params) {
    let qs = "";
    if (params) {
      const clean = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined) clean.append(k, String(v));
      }
      const s = clean.toString();
      if (s) qs = `?${s}`;
    }
    const url = `${this.baseUrl}${path}${qs}`;
    const headers = {
      Accept: "application/json",
      "User-Agent": `insider-signals-js/${VERSION}`,
    };
    if (this.rapidapiKey) {
      headers["X-RapidAPI-Key"] = this.rapidapiKey;
      headers["X-RapidAPI-Host"] = this.rapidapiHost;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    let resp;
    try {
      resp = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new InsiderSignalsError(resp.status, body);
    }
    return resp.json();
  }

  /** Every data route returns the same envelope; the rows live under `signals`. */
  static _signals(env) {
    return (env && env.signals) || [];
  }

  // --- health ------------------------------------------------------------
  /** Service health + dataset coverage. GET /v1/health. No key. */
  health() {
    return this._get("/v1/health");
  }

  // --- FREE tier: open /public/v1 discovery surface, no key --------------
  /** Today's filing-verified insider buy signals. GET /public/v1/signals/today. No key. */
  async today() {
    return InsiderSignals._signals(await this._get("/public/v1/signals/today"));
  }

  /** Cluster buys — 2+ insiders in one company, ≤7-day window.
   *  GET /public/v1/signals/clusters. No key. */
  async clusters() {
    return InsiderSignals._signals(await this._get("/public/v1/signals/clusters"));
  }

  /** Verify an insider open-market-purchase claim against collected Form-4 filings.
   *  Returns the full envelope (`status` is confirmed/partial/not_found/out_of_coverage).
   *  GET /public/v1/verify. No key. */
  verify(ticker, person, amountUsd = null) {
    return this._get("/public/v1/verify", {
      ticker: ticker.toUpperCase(),
      person,
      amount_usd: amountUsd,
    });
  }

  /** Verify a Schedule 13D activist-stake claim. GET /public/v1/verify/13d. No key. */
  verify13d(subjectName, filerName) {
    return this._get("/public/v1/verify/13d", {
      subject_name: subjectName,
      filer_name: filerName,
    });
  }

  /** Verify an 8-K material-event claim by CIK. GET /public/v1/verify/8k. No key. */
  verify8k(cik, companyName = null) {
    return this._get("/public/v1/verify/8k", { cik, company_name: companyName });
  }

  /** Verify a 13F institutional-holding claim (quarter = a quarter-end YYYY-MM-DD).
   *  GET /public/v1/verify/13f. No key. */
  verify13f(filer, issuerName, quarter) {
    return this._get("/public/v1/verify/13f", {
      filer,
      issuer_name: issuerName,
      quarter,
    });
  }

  // --- KEYED tier: full history/query surface via RapidAPI ---------------
  // These require a RapidAPI subscription: construct with baseUrl=<rapidapi-host>,
  // rapidapiKey="...". Without a key they return HTTP 403 (InsiderSignalsError).

  /** [keyed] Insider buy signals for one ticker. GET /v1/signals/ticker/{ticker}. */
  async byTicker(ticker) {
    const t = encodeURIComponent(ticker.toUpperCase());
    return InsiderSignals._signals(await this._get(`/v1/signals/ticker/${t}`));
  }

  /** [keyed] Insider buy signals over an inclusive filed-date range (YYYY-MM-DD).
   *  GET /v1/signals/range?start=&end=. */
  async byRange(start, end) {
    return InsiderSignals._signals(await this._get("/v1/signals/range", { start, end }));
  }

  /** [keyed] Look up a single Form 4 filing by accession number.
   *  GET /v1/signals/filing/{accession}. */
  async filing(accession) {
    const a = encodeURIComponent(accession);
    return InsiderSignals._signals(await this._get(`/v1/signals/filing/${a}`));
  }

  /** [keyed] 13F institutional position changes (added/increased/trimmed/exited).
   *  GET /v1/fund/changes. */
  async fundChanges({ filer = null, quarter = null, limit = null } = {}) {
    return InsiderSignals._signals(
      await this._get("/v1/fund/changes", { filer, quarter, limit }),
    );
  }

  /** [keyed] Recent federal contract awards (USAspending). GET /v1/usaspending/recent. */
  async federalAwardsRecent({ minAmount = null, limit = null } = {}) {
    return InsiderSignals._signals(
      await this._get("/v1/usaspending/recent", { min_amount: minAmount, limit }),
    );
  }

  /** [keyed] Recent activist 13D stakes (SEC EDGAR). GET /v1/activist/recent. */
  async activistStakesRecent({ minPercent = null, ticker = null, limit = null } = {}) {
    return InsiderSignals._signals(
      await this._get("/v1/activist/recent", {
        min_percent: minPercent,
        ticker,
        limit,
      }),
    );
  }
}

export default InsiderSignals;
