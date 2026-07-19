"""Load and filter explore vendors for planner needs (no LLM)."""

from __future__ import annotations

from typing import Any

from app.features.bookings.reviews import merge_review_stats_into_vendor_rows
from app.features.vendors.markets import normalize_country_code
from app.features.vendors.moderation import (
    get_approved_vendor_for_explore_by_id,
    list_approved_vendors_for_explore,
)
from app.features.vendors.public_metrics import merge_public_metrics_into_vendor_rows


def _payload(row: dict[str, Any]) -> dict[str, Any]:
    p = row.get("payload")
    return p if isinstance(p, dict) else {}


def _services(row: dict[str, Any]) -> set[str]:
    payload = _payload(row)
    raw = payload.get("servicesOffered")
    if not isinstance(raw, list):
        raw = row.get("services_offered") if isinstance(row.get("services_offered"), list) else []
    return {str(x).strip().lower() for x in (raw or []) if str(x).strip()}


def load_enriched_vendor_pool(*, country_code: str | None = "GB") -> list[dict[str, Any]]:
    """Approved explore vendors with review stats + public metrics."""
    rows = list_approved_vendors_for_explore(
        country_code=normalize_country_code(country_code),
    )
    rows = merge_review_stats_into_vendor_rows(rows)
    rows = merge_public_metrics_into_vendor_rows(rows)
    return rows


def get_enriched_vendor(vendor_user_id: str) -> dict[str, Any] | None:
    row = get_approved_vendor_for_explore_by_id(vendor_user_id)
    if not row:
        return None
    merged = merge_review_stats_into_vendor_rows([row])
    merged = merge_public_metrics_into_vendor_rows(merged)
    return merged[0] if merged else None


def filter_candidates_for_need(
    pool: list[dict[str, Any]],
    *,
    service_key: str,
    location: str | None = None,
    related_locations: list[str] | None = None,
    budget_band_gbp: float | None = None,
    keywords: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Hard-filter by service_key; soft-prefer location/budget via ordering hints
    (ranking engine applies scored location/budget fit).
    """
    key = (service_key or "").strip().lower()
    if not key:
        return []

    matched = [r for r in pool if key in _services(r)]
    if not matched:
        return []

    # Soft location preference: exact/related first, others keep for ranking widen
    loc = (location or "").strip().lower()
    related = {x.strip().lower() for x in (related_locations or []) if x and str(x).strip()}

    def loc_tier(row: dict[str, Any]) -> int:
        if not loc:
            return 1
        city = str(
            _payload(row).get("baseCity") or row.get("base_city_normalized") or "",
        ).strip().lower()
        if not city:
            return 2
        if city == loc or loc in city or city in loc:
            return 0
        if city in related or any(r in city or city in r for r in related):
            return 1
        return 2

    def budget_tier(row: dict[str, Any]) -> int:
        if budget_band_gbp is None or budget_band_gbp <= 0:
            return 0
        price = row.get("min_list_price_gbp")
        if price is None:
            return 1  # quote-only — keep, ranking uses neutral
        try:
            p = float(price)
        except (TypeError, ValueError):
            return 1
        if p <= budget_band_gbp * 1.25:
            return 0
        return 2

    kw = [k.lower() for k in (keywords or []) if k and str(k).strip()]

    def keyword_bonus(row: dict[str, Any]) -> int:
        if not kw:
            return 0
        blob = " ".join(
            [
                str(_payload(row).get("businessName") or ""),
                str(_payload(row).get("aiBioDraft") or ""),
                " ".join(_services(row)),
            ],
        ).lower()
        return -sum(1 for k in kw if k in blob)

    matched.sort(key=lambda r: (loc_tier(r), budget_tier(r), keyword_bonus(r), str(r.get("user_id") or "")))
    return matched
