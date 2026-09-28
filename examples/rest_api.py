#!/usr/bin/env python3
"""Example: pull insider buy signals over the REST API with the `insider_signals` client.

    pip install insider-signals      # or: pip install -e .  from the repo root
    python examples/rest_api.py

Everything here runs on the FREE tier — no key. The discovery surface (today, clusters,
and the verify* family) answers on /public/v1 with per-IP rate limiting. The keyed history
surface (by_ticker, by_range, filing, fund_changes, ...) needs a RapidAPI subscription:
construct with InsiderSignals(base_url=<rapidapi-host>, rapidapi_key="...").
"""
from insider_signals import InsiderSignals


def main() -> None:
    api = InsiderSignals()  # public base URL, no key needed for the free tier

    h = api.health()
    ins = h.get("datasets", {}).get("insider", {})
    print(f"health: {h.get('status', '?')}  "
          f"coverage: {ins.get('days', '?')} days "
          f"{ins.get('earliest', '?')}..{ins.get('latest', '?')}")

    print("\n# Today's signals")
    today = api.today()
    if not today:
        print("  (no signals filed today yet — markets/filings run on business days)")
    for s in today[:10]:
        _print_signal(s)

    print("\n# Cluster buys (2+ insiders, one company, within a 7-day window)")
    for s in api.clusters()[:10]:
        _print_signal(s)

    print("\n# Verify a specific insider open-market-purchase claim")
    v = api.verify("ETRA", "ORBIMED ADVISORS LLC")
    print(f"  status={v.get('status')}  count={v.get('count')}  "
          f"coverage {v.get('coverage_start')}..{v.get('coverage_end')}")

    print("\n# Verify a 13D activist stake / an 8-K item / a 13F holding")
    print("  13d:", api.verify_13d("New Fortress Energy Inc.",
                                   "Strategic Value Partners, LLC").get("status"))
    print("  8k :", api.verify_8k("1650648", "4D Molecular Therapeutics, Inc.").get("status"))
    print("  13f:", api.verify_13f("BERKSHIRE HATHAWAY INC", "ALPHABET INC",
                                   "2026-06-30").get("status"))


def _print_signal(s: dict) -> None:
    # Every field is parsed from the filing; filing_url is the sec.gov source (Rule 2).
    val = s.get("value_usd")
    val_s = f"${val:,.0f}" if isinstance(val, (int, float)) else "?"
    tag = "cluster" if s.get("cluster") else "large buy"
    print(f"  {str(s.get('ticker','?')).upper():6} {val_s:>12}  {tag:9}  "
          f"{s.get('insider','?')}  ->  {s.get('filing_url','(no link — should never happen)')}")


if __name__ == "__main__":
    main()
