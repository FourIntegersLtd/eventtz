"""Filtered explore search over approved vendors (payload JSON)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Literal

from app.core.logging import get_logger
from app.features.bookings.reviews import merge_review_stats_into_vendor_rows
from app.features.vendors.moderation import list_approved_vendors_for_explore
from app.features.vendors.search_ai import parse_marketplace_query

logger = get_logger(__name__)

from app.features.vendors.list_pricing import min_listing_price_gbp

SortKey = Literal["relevance", "price_asc", "price_desc", "proximity", "rating"]


def _services_offered(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("servicesOffered")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip()]


def _parse_types_param(types: str | None) -> list[str]:
    if not types or not str(types).strip():
        return []
    return [t.strip() for t in str(types).split(",") if t.strip()]


def _parse_dates_param(dates: str | None) -> list[str]:
    if not dates or not str(dates).strip():
        return []
    parts = [d.strip() for d in str(dates).split(",") if d.strip()]
    return parts[:3]


def _normalize_iso_date(raw: str) -> str | None:
    """Return YYYY-MM-DD or None if invalid."""
    s = raw.strip()
    if len(s) >= 10:
        s = s[:10]
    try:
        date.fromisoformat(s)
    except ValueError:
        return None
    return s


def _blocked_dates_set(payload: dict[str, Any]) -> set[str]:
    raw = payload.get("blockedDates")
    if not isinstance(raw, list):
        return set()
    out: set[str] = set()
    for x in raw:
        if not isinstance(x, str):
            continue
        n = _normalize_iso_date(x)
        if n:
            out.add(n)
    return out


def _available_weekdays_set(payload: dict[str, Any]) -> set[int]:
    """Weekdays as in onboarding: 0=Monday … 6=Sunday."""
    raw = payload.get("availableWeekdays")
    if not isinstance(raw, list):
        return set()
    out: set[int] = set()
    for x in raw:
        if isinstance(x, bool) or not isinstance(x, (int, float)):
            continue
        d = int(x)
        if 0 <= d <= 6:
            out.add(d)
    return out


def _vendor_available_for_event_dates(
    payload: dict[str, Any],
    event_dates: list[str],
) -> bool:
    """
    Uses onboarding fields: blockedDates (YYYY-MM-DD), availableWeekdays (Mon=0 … Sun=6).
    If availableWeekdays is empty (legacy data), weekday check is skipped; blocked dates still apply.
    """
    if not event_dates:
        return True

    blocked = _blocked_dates_set(payload)
    weekdays_ok = _available_weekdays_set(payload)

    for raw in event_dates:
        iso = _normalize_iso_date(raw)
        if iso is None:
            continue
        if iso in blocked:
            return False
        try:
            d = date.fromisoformat(iso)
        except ValueError:
            continue
        w = d.weekday()
        if weekdays_ok and w not in weekdays_ok:
            return False
    return True


def _event_types_offered(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("eventTypes")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip()]


def _vendor_search_haystack(row: dict[str, Any], payload: dict[str, Any]) -> str:
    svcs = _services_offered(payload)
    event_types = _event_types_offered(payload)
    return " ".join(
        [
            str(payload.get("baseCity") or ""),
            str(payload.get("businessName") or ""),
            " ".join(svcs),
            " ".join(event_types),
            str(payload.get("aiBioDraft") or ""),
            str(row.get("email") or ""),
        ],
    ).lower()


def _keyword_hit_count(haystack: str, keywords: list[str]) -> int:
    if not keywords:
        return 0
    return sum(1 for kw in keywords if kw and kw in haystack)


def _relevance_score(
    *,
    matched_types: int,
    location: str,
    base_city: str,
    keyword_hits: int = 0,
    event_type_hits: int = 0,
) -> float:
    loc = location.strip().lower()
    city = base_city.strip().lower()
    bonus = 2.0 if loc and city and loc in city else (1.0 if loc and city and city in loc else 0.0)
    return matched_types * 10.0 + bonus + keyword_hits * 3.0 + event_type_hits * 2.0


def search_approved_vendors(
    *,
    types: str | None = None,
    location: str | None = None,
    q: str | None = None,
    dates: str | None = None,
    flexible: bool = False,
    budget_min: float | None = None,
    budget_max: float | None = None,
    sort: str = "relevance",
) -> list[dict[str, Any]]:
    """
    Returns approved vendors with optional filters.

    When the client sends specific event dates and ``flexible`` is false, vendors are
    excluded if a date falls on ``blockedDates`` or outside ``availableWeekdays`` in
    the onboarding payload. If ``flexible`` is true or no dates are sent, availability
    by date is not applied.
    """
    rows = list_approved_vendors_for_explore()
    type_filters = _parse_types_param(types)
    date_parts = _parse_dates_param(dates)

    raw_q = (q or "").strip()
    parsed = parse_marketplace_query(raw_q) if raw_q else None
    if not type_filters and parsed and parsed.types:
        type_filters = list(parsed.types)

    location_filter = (location or "").strip()
    if not location_filter and parsed and parsed.location:
        location_filter = parsed.location.strip()

    keywords: list[str] = list(parsed.keywords) if parsed else []
    if not keywords and raw_q:
        keywords = [w for w in raw_q.lower().split() if len(w) >= 2][:16]

    parsed_event_types = list(parsed.event_types) if parsed else []

    sort_key = sort.strip().lower() if sort else "relevance"
    if sort_key not in ("relevance", "price_asc", "price_desc", "proximity", "rating"):
        sort_key = "relevance"

    apply_date_availability = bool(date_parts) and not flexible

    enriched: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        if apply_date_availability and not _vendor_available_for_event_dates(payload, date_parts):
            continue
        svcs = _services_offered(payload)
        if type_filters:
            matched = [t for t in type_filters if t in svcs]
            if not matched:
                continue
        else:
            matched = list(svcs) if svcs else []

        base_city = str(payload.get("baseCity") or "")
        hay = _vendor_search_haystack(row, payload)
        if keywords:
            if _keyword_hit_count(hay, keywords) == 0:
                continue

        min_price = min_listing_price_gbp(payload)
        if budget_min is not None and min_price is not None and min_price < budget_min:
            continue
        if budget_max is not None and min_price is not None and min_price > budget_max:
            continue

        if type_filters:
            matched_services = [t for t in type_filters if t in svcs]
        else:
            matched_services = list(svcs)

        updated_at = row.get("updated_at")
        ts = 0.0
        if isinstance(updated_at, str):
            try:
                ts = datetime.fromisoformat(updated_at.replace("Z", "+00:00")).timestamp()
            except ValueError:
                ts = 0.0

        n_type_hits = len([t for t in type_filters if t in svcs]) if type_filters else max(1, len(svcs))
        vendor_events = _event_types_offered(payload)
        event_type_hits = len([t for t in parsed_event_types if t in vendor_events]) if parsed_event_types else 0
        kw_hits = _keyword_hit_count(hay, keywords) if keywords else 0
        score = _relevance_score(
            matched_types=n_type_hits,
            location=location_filter,
            base_city=base_city,
            keyword_hits=kw_hits,
            event_type_hits=event_type_hits,
        )

        out_row = {
            "user_id": str(row.get("user_id") or ""),
            "email": row.get("email"),
            "status": row.get("status"),
            "approval_status": row.get("approval_status"),
            "payload": payload,
            "updated_at": row.get("updated_at"),
            "matched_services": matched_services,
            "_min_price": min_price,
            "_ts": ts,
            "_score": score,
        }
        enriched.append(out_row)

    enriched = merge_review_stats_into_vendor_rows(enriched)

    def sort_key_fn(r: dict[str, Any]) -> tuple[Any, ...]:
        mp = r.get("_min_price")
        ts = float(r.get("_ts") or 0)
        sc = float(r.get("_score") or 0)
        if sort_key == "price_asc":
            return (mp is None, mp if mp is not None else 1e18, -ts)
        if sort_key == "price_desc":
            return (mp is None, -(mp if mp is not None else 0), -ts)
        if sort_key == "proximity":
            return (-ts,)
        if sort_key == "rating":
            avg = float(r.get("review_average") or 0)
            cnt = int(r.get("review_count") or 0)
            return (-avg, -cnt, -ts)
        # relevance (default)
        return (-sc, -ts)

    enriched.sort(key=sort_key_fn)

    for r in enriched:
        r.pop("_min_price", None)
        r.pop("_ts", None)
        r.pop("_score", None)

    return enriched


# Max inclusive span for multi-day events (abuse guard).
_MAX_EVENT_SPAN_DAYS = 366


def iso_dates_in_event_range(event_date: date, event_end_date: date | None) -> list[str]:
    """Every calendar day from event_date through event_end_date (inclusive)."""
    if event_end_date is None:
        return [event_date.isoformat()]
    if event_end_date < event_date:
        raise ValueError("Event end date must be on or after the event start date.")
    if (event_end_date - event_date).days > _MAX_EVENT_SPAN_DAYS:
        raise ValueError(f"Event cannot span more than {_MAX_EVENT_SPAN_DAYS} days.")
    out: list[str] = []
    d = event_date
    while d <= event_end_date:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def assert_vendor_payload_allows_event_dates(
    payload: dict[str, Any],
    *,
    event_date: date,
    event_end_date: date | None,
) -> None:
    """Raises ValueError if any day in range is blocked or on a non-working weekday."""
    iso_dates = iso_dates_in_event_range(event_date, event_end_date)
    if not _vendor_available_for_event_dates(payload, iso_dates):
        raise ValueError(
            "The event date(s) fall on days this vendor has marked unavailable. "
            "Choose different dates or contact the vendor via Messages.",
        )
