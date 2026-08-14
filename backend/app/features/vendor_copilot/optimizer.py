"""Post-launch listing optimizer — extends onboarding package coach."""

from __future__ import annotations

from typing import Any

from app.features.vendors.onboarding_ai import review_vendor_packages


def review_listing_packages(*, payload: dict[str, Any]) -> dict[str, Any]:
    """Run package coach with post-launch conversion focus (same engine, vendor-facing)."""
    result = review_vendor_packages(payload=payload)
    summary = str(result.get("summary") or "").strip()
    if summary and "onboarding" not in summary.lower():
        result["summary"] = summary
    elif not summary:
        result["summary"] = "Here are a few ways to make your packages easier to book."
    return result
