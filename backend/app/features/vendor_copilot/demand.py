"""Anonymized marketplace demand signals for vendor growth coaching."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

_SERVICE_LABELS: dict[str, str] = {
    "catering": "Catering",
    "baking": "Cakes & baking",
    "photography": "Photography",
    "videography": "Videography",
    "makeup": "Makeup",
    "decor": "Decor",
    "rentals": "Rentals",
    "entertainment": "Entertainment",
    "dj": "DJ",
    "mc": "MC / host",
}


def _service_label(key: str) -> str:
    return _SERVICE_LABELS.get(key.strip().lower(), key.replace("_", " ").title())


def get_market_demand_insights(
    *,
    base_city: str,
    services: list[str],
    country_code: str = "GB",
    days: int = 90,
) -> list[dict[str, Any]]:
    """Return up to 3 demand insights for vendor city + service categories."""
    if get_settings().local_auth_mode:
        return []

    days = max(14, min(days, 180))
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    city_norm = base_city.strip().lower()
    vendor_services = {s.strip().lower() for s in services if s.strip()}
    if not vendor_services:
        return []

    insights: list[dict[str, Any]] = []

    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id,created_at,event_name")
            .eq("initiator", "client")
            .gte("created_at", start)
            .limit(2000)
            .execute()
        )
        enquiry_rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("vendor_copilot demand: enquiries load failed")
        enquiry_rows = []

    total_enquiries = len(enquiry_rows)

    try:
        vendor_res = (
            get_client()
            .table("vendors")
            .select("user_id,payload,country_code")
            .eq("approval_status", "approved")
            .limit(500)
            .execute()
        )
        vendor_rows = [r for r in (getattr(vendor_res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("vendor_copilot demand: vendors load failed")
        vendor_rows = []

    service_counts: dict[str, int] = defaultdict(int)
    city_service_counts: dict[str, int] = defaultdict(int)

    for row in vendor_rows:
        payload = row.get("payload")
        if not isinstance(payload, dict):
            continue
        row_city = str(payload.get("baseCity") or "").strip().lower()
        row_country = str(row.get("country_code") or payload.get("countryCode") or "GB").upper()
        if row_country != country_code.upper():
            continue
        svcs = payload.get("servicesOffered")
        if not isinstance(svcs, list):
            continue
        for svc in svcs:
            key = str(svc).strip().lower()
            if not key:
                continue
            service_counts[key] += 1
            if city_norm and row_city == city_norm:
                city_service_counts[key] += 1

    for svc in sorted(vendor_services):
        label = _service_label(svc)
        market_count = service_counts.get(svc, 0)
        city_count = city_service_counts.get(svc, 0)
        if market_count >= 3:
            if city_norm and city_count >= 2:
                insights.append(
                    {
                        "headline": f"{label} is active in {base_city}",
                        "detail": (
                            f"There are {city_count} approved {label.lower()} vendors in your city. "
                            "Stand out with clear packages, fast replies, and strong portfolio photos."
                        ),
                        "service_category": svc,
                    }
                )
            elif market_count >= 10:
                insights.append(
                    {
                        "headline": f"Strong demand for {label.lower()} on Eventtz",
                        "detail": (
                            f"{label} is one of the most listed services on the marketplace. "
                            "Clients compare packages side by side — make yours specific and bookable."
                        ),
                        "service_category": svc,
                    }
                )

    if total_enquiries >= 20:
        insights.append(
            {
                "headline": "Enquiries are flowing on Eventtz",
                "detail": (
                    f"Over {total_enquiries} client enquiries were sent in the last {days} days. "
                    "Vendors who reply within 2 hours win more bookings."
                ),
                "service_category": None,
            }
        )
    elif total_enquiries >= 5:
        insights.append(
            {
                "headline": "Clients are actively booking vendors",
                "detail": (
                    "New enquiries come in every week. Keep your listing live and respond quickly "
                    "when a request arrives."
                ),
                "service_category": None,
            }
        )

    if city_norm and not any(i.get("service_category") for i in insights):
        insights.append(
            {
                "headline": f"Grow your presence in {base_city}",
                "detail": (
                    "Complete your profile, add 3+ portfolio photos, and set weekday availability "
                    "so clients can find and book you."
                ),
                "service_category": None,
            }
        )

    return insights[:3]
