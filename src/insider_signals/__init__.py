"""Insider Buy Signals — a tiny, dependency-free Python client for the TradeStar Insider API.

Filing-verified U.S. insider open-market purchase signals from SEC EDGAR Form 4. Every field
returned traces to a parsed field in a real filing and carries its ``filing_url`` on sec.gov
(the service is filing-verified); records that can't be linked to a filing are dropped, never guessed.

    from insider_signals import InsiderSignals

    api = InsiderSignals()                 # defaults to the public base URL, no key
    for s in api.today():                  # free tier: today, clusters, verify*
        print(s["ticker"], s["value_usd"], s["filing_url"])

Two tiers, one client:

- **Free (no key):** ``today()``, ``clusters()``, and the ``verify*()`` family answer on the
  open ``/public/v1`` discovery surface with no key and per-IP rate limiting.
- **Keyed (RapidAPI):** the full history/query surface — ``by_ticker()``, ``by_range()``,
  ``filing()``, ``federal_awards_recent()``, ``activist_stakes_recent()``, ``fund_changes()``
  — is metered through RapidAPI. Pass ``rapidapi_key`` and point ``base_url`` at your RapidAPI
  host. Calling a keyed method without a key returns HTTP 403 (``InsiderSignalsError``).

The REST contract is OpenAPI 3.0.2 at {BASE}/v1/openapi.json. This client uses only the Python
standard library, so it has no install dependencies and doubles as a readable reference.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

__version__ = "1.0.0"
__all__ = ["InsiderSignals", "InsiderSignalsError", "DEFAULT_BASE_URL"]

DEFAULT_BASE_URL = "https://api.tradestarinsider.com"


class InsiderSignalsError(RuntimeError):
    """Raised on a non-2xx API response. ``status`` and ``body`` hold the HTTP detail."""

    def __init__(self, status: int, body: str):
        super().__init__(f"API error {status}: {body[:300]}")
        self.status = status
        self.body = body


class InsiderSignals:
    """Client for the Insider Buy Signals REST API.

    Args:
        base_url: API base (default the public host). Point at a RapidAPI gateway host if you
            subscribe through RapidAPI; pass ``rapidapi_key`` to send the proxy headers.
        rapidapi_key: optional RapidAPI key; when set, ``X-RapidAPI-Key`` / ``X-RapidAPI-Host``
            headers are attached to every request.
        timeout: per-request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        rapidapi_key: str | None = None,
        rapidapi_host: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.rapidapi_key = rapidapi_key
        self.rapidapi_host = rapidapi_host or urllib.parse.urlparse(self.base_url).netloc
        self.timeout = timeout

    # --- low-level ---------------------------------------------------------
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        qs = ""
        if params:
            clean = {k: v for k, v in params.items() if v is not None}
            if clean:
                qs = "?" + urllib.parse.urlencode(clean)
        url = f"{self.base_url}{path}{qs}"
        headers = {"Accept": "application/json", "User-Agent": f"insider-signals-py/{__version__}"}
        if self.rapidapi_key:
            headers["X-RapidAPI-Key"] = self.rapidapi_key
            headers["X-RapidAPI-Host"] = self.rapidapi_host
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise InsiderSignalsError(e.code, e.read().decode("utf-8", "replace")) from None

    @staticmethod
    def _signals(env: dict[str, Any]) -> list[dict[str, Any]]:
        """Every data route returns the same envelope; the rows live under ``signals``."""
        return env.get("signals", []) or []

    # --- health ------------------------------------------------------------
    def health(self) -> dict[str, Any]:
        """Service health + dataset coverage. GET /v1/health. No key."""
        return self._get("/v1/health")

    # --- FREE tier: open /public/v1 discovery surface, no key --------------
    def today(self) -> list[dict[str, Any]]:
        """Today's filing-verified insider buy signals. GET /public/v1/signals/today. No key."""
        return self._signals(self._get("/public/v1/signals/today"))

    def clusters(self) -> list[dict[str, Any]]:
        """Cluster buys — 2+ insiders in one company, ≤7-day window.
        GET /public/v1/signals/clusters. No key."""
        return self._signals(self._get("/public/v1/signals/clusters"))

    def verify(
        self, ticker: str, person: str, amount_usd: float | None = None
    ) -> dict[str, Any]:
        """Verify an insider open-market-purchase claim against collected Form-4 filings.
        Returns the full envelope (``status`` is confirmed/partial/not_found/out_of_coverage).
        GET /public/v1/verify. No key."""
        return self._get(
            "/public/v1/verify",
            {"ticker": ticker.upper(), "person": person, "amount_usd": amount_usd})

    def verify_13d(self, subject_name: str, filer_name: str) -> dict[str, Any]:
        """Verify a Schedule 13D activist-stake claim. GET /public/v1/verify/13d. No key."""
        return self._get(
            "/public/v1/verify/13d",
            {"subject_name": subject_name, "filer_name": filer_name})

    def verify_8k(self, cik: str, company_name: str | None = None) -> dict[str, Any]:
        """Verify an 8-K material-event claim by CIK. GET /public/v1/verify/8k. No key."""
        return self._get(
            "/public/v1/verify/8k", {"cik": cik, "company_name": company_name})

    def verify_13f(
        self, filer: str, issuer_name: str, quarter: str
    ) -> dict[str, Any]:
        """Verify a 13F institutional-holding claim (quarter = a quarter-end YYYY-MM-DD).
        GET /public/v1/verify/13f. No key."""
        return self._get(
            "/public/v1/verify/13f",
            {"filer": filer, "issuer_name": issuer_name, "quarter": quarter})

    # --- KEYED tier: full history/query surface via RapidAPI ---------------
    # These require a RapidAPI subscription: construct with base_url=<rapidapi-host>,
    # rapidapi_key="...". Without a key they return HTTP 403 (InsiderSignalsError).
    def by_ticker(self, ticker: str) -> list[dict[str, Any]]:
        """[keyed] Insider buy signals for one ticker. GET /v1/signals/ticker/{ticker}."""
        return self._signals(self._get(f"/v1/signals/ticker/{urllib.parse.quote(ticker.upper())}"))

    def by_range(self, start: str, end: str) -> list[dict[str, Any]]:
        """[keyed] Insider buy signals over an inclusive filed-date range (YYYY-MM-DD).
        GET /v1/signals/range?start=&end=."""
        return self._signals(self._get("/v1/signals/range", {"start": start, "end": end}))

    def filing(self, accession: str) -> list[dict[str, Any]]:
        """[keyed] Look up a single Form 4 filing by accession number.
        GET /v1/signals/filing/{accession}."""
        return self._signals(self._get(f"/v1/signals/filing/{urllib.parse.quote(accession)}"))

    def fund_changes(
        self, filer: str | None = None, quarter: str | None = None, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """[keyed] 13F institutional position changes (added/increased/trimmed/exited).
        GET /v1/fund/changes."""
        return self._signals(
            self._get("/v1/fund/changes", {"filer": filer, "quarter": quarter, "limit": limit}))

    def federal_awards_recent(
        self, min_amount: float | None = None, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """[keyed] Recent federal contract awards (USAspending). GET /v1/usaspending/recent."""
        return self._signals(
            self._get("/v1/usaspending/recent", {"min_amount": min_amount, "limit": limit}))

    def activist_stakes_recent(
        self, min_percent: float | None = None, ticker: str | None = None, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """[keyed] Recent activist 13D stakes (SEC EDGAR). GET /v1/activist/recent."""
        return self._signals(
            self._get("/v1/activist/recent",
                      {"min_percent": min_percent, "ticker": ticker, "limit": limit}))
