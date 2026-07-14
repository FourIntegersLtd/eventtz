"""Filtered explore search over approved vendors (payload JSON)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Literal

from app.contracts.marketplace_search import MarketplaceSearchResult
from app.core.logging import get_logger
from app.features.vendors.list_pricing import min_listing_price_gbp
from app.features.vendors.moderation import list_approved_vendors_for_explore
from app.features.vendors.search_ai import parse_marketplace_query

logger = get_logger(__name__)

SortKey = Literal["relevance", "price_asc", "price_desc", "proximity", "rating"]
MatchTier = Literal["exact", "related", "fallback"]

_TIER_RANK = {"exact": 0, "related": 1, "fallback": 2}


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


def _location_bonus(location: str, base_city: str, related_locations: list[str]) -> float:
    loc = location.strip().lower()
    city = base_city.strip().lower()
    if loc and city:
        if loc in city or city in loc:
            return 2.0
    for related in related_locations:
        r = related.strip().lower()
        if r and city and (r in city or city in r):
            return 1.0
    return 0.0


def _relevance_score(
    *,
    matched_types: int,
    location: str,
    base_city: str,
    related_locations: list[str] | None = None,
    keyword_hits: int = 0,
    related_keyword_hits: int = 0,
    event_type_hits: int = 0,
) -> float:
    bonus = _location_bonus(location, base_city, related_locations or [])
    return (
        matched_types * 10.0
        + bonus
        + keyword_hits * 3.0
        + related_keyword_hits * 1.5
        + event_type_hits * 2.0
    )


def _passes_budget(
    payload: dict[str, Any],
    *,
    budget_min: float | None,
    budget_max: float | None,
) -> tuple[bool, float | None]:
    min_price = min_listing_price_gbp(payload)
    if budget_min is not None and min_price is not None and min_price < budget_min:
        return False, min_price
    if budget_max is not None and min_price is not None and min_price > budget_max:
        return False, min_price
    return True, min_price


def _updated_ts(row: dict[str, Any]) -> float:
    updated_at = row.get("updated_at")
    if isinstance(updated_at, str):
        try:
            return datetime.fromisoformat(updated_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0.0
    return 0.0


def _build_match_notice(
    *,
    has_exact: bool,
    has_related: bool,
    has_fallback: bool,
    intent_summary: str | None,
    date_softened: bool,
) -> str | None:
    if has_exact and not has_related and not has_fallback:
        return None
    base = (intent_summary or "").strip()
    if has_exact and (has_related or has_fallback):
        return None  # FE shows "Also consider" divider; no scary banner
    if has_related and not has_exact:
        bits = ["No exact matches — showing close options"]
        if base:
            bits.append(f"for {base}")
        if date_softened:
            bits.append("(including vendors not free on your selected dates)")
        return " ".join(bits)
    if has_fallback and not has_exact and not has_related:
        bits = ["No close matches — showing similar vendors"]
        if base:
            bits.append(f"related to {base}")
        return " ".join(bits)
    return None


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
    vendor_user_ids: list[str] | None = None,
    limit: int = 200,
    offset: int = 0,
) -> MarketplaceSearchResult:
    """
    Returns approved vendors with optional filters, ordered exact → related → fallback.

    When the client sends specific event dates and ``flexible`` is false, Exact-tier
    vendors must be available. Date misses with an otherwise-related profile can still
    appear in Related. If Exact+Related are empty, Fallback returns same-type (or all)
    approved vendors so browse is rarely blank.
    """
    chip_types = _parse_types_param(types)
    date_parts = _parse_dates_param(dates)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    raw_q = (q or "").strip()
    parsed = parse_marketplace_query(raw_q) if raw_q else None

    city_query = (location or "").strip() or None
    if not city_query and parsed and parsed.location:
        city_query = parsed.location

    rows = list_approved_vendors_for_explore(
        vendor_user_ids=vendor_user_ids,
        budget_min=budget_min,
        budget_max=budget_max,
        service_types=chip_types or None,
        city_query=city_query,
    )

    primary_types = list(chip_types)
    if not primary_types and parsed and parsed.types:
        primary_types = list(parsed.types)

    related_types = list(parsed.related_types) if parsed else []
    related_types = [t for t in related_types if t not in primary_types]

    location_filter = (location or "").strip()
    if not location_filter and parsed and parsed.location:
        location_filter = parsed.location.strip()
    related_locations = list(parsed.related_locations) if parsed else []

    keywords: list[str] = list(parsed.keywords) if parsed else []
    if not keywords and raw_q:
        keywords = [w for w in raw_q.lower().split() if len(w) >= 2][:16]
    related_keywords: list[str] = list(parsed.related_keywords) if parsed else []

    parsed_event_types = list(parsed.event_types) if parsed else []
    intent_summary = parsed.intent_summary if parsed else None

    sort_key = sort.strip().lower() if sort else "relevance"
    if sort_key not in ("relevance", "price_asc", "price_desc", "proximity", "rating"):
        sort_key = "relevance"

    apply_date_availability = bool(date_parts) and not flexible
    date_softened = False

    # Broad pool for fallback: ignore text/date, keep budget + optional primary/related type.
    fallback_type_pool = primary_types or related_types

    exact_rows: list[dict[str, Any]] = []
    related_rows: list[dict[str, Any]] = []
    candidates_by_id: dict[str, dict[str, Any]] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        uid = str(row.get("user_id") or "")
        if not uid:
            continue

        ok_budget, min_price = _passes_budget(
            payload, budget_min=budget_min, budget_max=budget_max,
        )
        if not ok_budget:
            continue

        svcs = _services_offered(payload)
        base_city = str(payload.get("baseCity") or "")
        hay = _vendor_search_haystack(row, payload)
        available = (
            _vendor_available_for_event_dates(payload, date_parts)
            if apply_date_availability
            else True
        )

        primary_svc_hits = [t for t in primary_types if t in svcs] if primary_types else []
        related_svc_hits = [t for t in related_types if t in svcs] if related_types else []
        type_ok_exact = (not primary_types) or bool(primary_svc_hits)
        type_ok_related = bool(related_svc_hits) or (
            bool(primary_types) and bool(primary_svc_hits)
        )

        kw_hits = _keyword_hit_count(hay, keywords) if keywords else 0
        rel_kw_hits = _keyword_hit_count(hay, related_keywords) if related_keywords else 0
        keyword_ok_exact = (not keywords) or kw_hits > 0
        keyword_ok_related = kw_hits > 0 or rel_kw_hits > 0 or (not keywords and not related_keywords)

        loc_l = location_filter.strip().lower()
        city_l = base_city.strip().lower()
        primary_loc_hit = bool(loc_l and city_l and (loc_l in city_l or city_l in loc_l))
        related_loc_hit = False
        for rl in related_locations:
            r = rl.strip().lower()
            if r and city_l and (r in city_l or city_l in r):
                related_loc_hit = True
                break

        vendor_events = _event_types_offered(payload)
        event_type_hits = (
            len([t for t in parsed_event_types if t in vendor_events]) if parsed_event_types else 0
        )

        if primary_types:
            matched_services = list(dict.fromkeys(primary_svc_hits + related_svc_hits))
        else:
            matched_services = list(svcs)

        n_type_hits = len(primary_svc_hits) if primary_types else max(1, len(svcs))
        score = _relevance_score(
            matched_types=n_type_hits,
            location=location_filter,
            base_city=base_city,
            related_locations=related_locations,
            keyword_hits=kw_hits,
            related_keyword_hits=rel_kw_hits,
            event_type_hits=event_type_hits,
        )
        # Soft location preference is scoring-only (never hard exclude).
        if primary_loc_hit:
            score += 0.5

        out_row = {
            "user_id": uid,
            "email": row.get("email"),
            "status": row.get("status"),
            "approval_status": row.get("approval_status"),
            "payload": payload,
            "updated_at": row.get("updated_at"),
            "matched_services": matched_services,
            "_min_price": min_price,
            "_ts": _updated_ts(row),
            "_score": score,
        }
        candidates_by_id[uid] = {
            **out_row,
            "_available": available,
            "_type_ok_exact": type_ok_exact,
            "_type_ok_related": type_ok_related or type_ok_exact,
            "_keyword_ok_exact": keyword_ok_exact,
            "_keyword_ok_related": keyword_ok_related or keyword_ok_exact,
            "_primary_svc": bool(primary_svc_hits),
            "_related_or_primary_svc": bool(primary_svc_hits or related_svc_hits) or not (
                primary_types or related_types
            ),
            "_related_loc_hit": related_loc_hit or primary_loc_hit,
        }

        # --- Tier A Exact ---
        if type_ok_exact and keyword_ok_exact and available:
            exact_rows.append({**out_row, "match_tier": "exact"})
            continue

        # --- Tier B Related ---
        related_ok = False
        if type_ok_related and (keyword_ok_related or related_loc_hit or primary_loc_hit):
            related_ok = True
        if type_ok_exact and not available and apply_date_availability:
            # Same type/profile but busy on the date → still useful.
            related_ok = True
            date_softened = True
        if type_ok_exact and not keyword_ok_exact and (rel_kw_hits > 0 or related_loc_hit):
            related_ok = True
        if related_ok:
            related_rows.append({**out_row, "match_tier": "related"})

    exact_ids = {r["user_id"] for r in exact_rows}
    related_rows = [r for r in related_rows if r["user_id"] not in exact_ids]

    fallback_rows: list[dict[str, Any]] = []
    if not exact_rows and not related_rows:
        for uid, cand in candidates_by_id.items():
            if fallback_type_pool:
                svcs = _services_offered(cand["payload"])
                if not any(t in svcs for t in fallback_type_pool):
                    continue
            fallback_rows.append(
                {
                    "user_id": cand["user_id"],
                    "email": cand.get("email"),
                    "status": cand.get("status"),
                    "approval_status": cand.get("approval_status"),
                    "payload": cand.get("payload"),
                    "updated_at": cand.get("updated_at"),
                    "matched_services": cand.get("matched_services") or [],
                    "match_tier": "fallback",
                    "_min_price": cand.get("_min_price"),
                    "_ts": cand.get("_ts"),
                    "_score": float(cand.get("_score") or 0) * 0.5,
                },
            )

        # Absolute last resort: any approved vendor that passed budget.
        if not fallback_rows:
            for cand in candidates_by_id.values():
                fallback_rows.append(
                    {
                        "user_id": cand["user_id"],
                        "email": cand.get("email"),
                        "status": cand.get("status"),
                        "approval_status": cand.get("approval_status"),
                        "payload": cand.get("payload"),
                        "updated_at": cand.get("updated_at"),
                        "matched_services": cand.get("matched_services") or [],
                        "match_tier": "fallback",
                        "_min_price": cand.get("_min_price"),
                        "_ts": cand.get("_ts"),
                        "_score": float(cand.get("_score") or 0) * 0.25,
                    },
                )

    enriched = exact_rows + related_rows + fallback_rows
    # Lazy import: bookings.reviews → bookings.__init__ → calendar → search (cycle).
    from app.features.bookings.reviews import merge_review_stats_into_vendor_rows

    enriched = merge_review_stats_into_vendor_rows(enriched)

    def sort_key_fn(r: dict[str, Any]) -> tuple[Any, ...]:
        tier = _TIER_RANK.get(str(r.get("match_tier") or "exact"), 0)
        mp = r.get("_min_price")
        ts = float(r.get("_ts") or 0)
        sc = float(r.get("_score") or 0)
        if sort_key == "price_asc":
            return (tier, mp is None, mp if mp is not None else 1e18, -ts)
        if sort_key == "price_desc":
            return (tier, mp is None, -(mp if mp is not None else 0), -ts)
        if sort_key == "proximity":
            return (tier, -ts)
        if sort_key == "rating":
            avg = float(r.get("review_average") or 0)
            cnt = int(r.get("review_count") or 0)
            return (tier, -avg, -cnt, -ts)
        return (tier, -sc, -ts)

    enriched.sort(key=sort_key_fn)

    for r in enriched:
        r.pop("_min_price", None)
        r.pop("_ts", None)
        r.pop("_score", None)

    has_exact = any(r.get("match_tier") == "exact" for r in enriched)
    has_related = any(r.get("match_tier") == "related" for r in enriched)
    has_fallback = any(r.get("match_tier") == "fallback" for r in enriched)

    notice = _build_match_notice(
        has_exact=has_exact,
        has_related=has_related,
        has_fallback=has_fallback,
        intent_summary=intent_summary,
        date_softened=date_softened,
    )

    total_count = len(enriched)
    enriched = enriched[offset : offset + limit]

    logger.info(
        "search_approved_vendors exact=%s related=%s fallback=%s total=%s q=%r",
        sum(1 for r in enriched if r.get("match_tier") == "exact"),
        sum(1 for r in enriched if r.get("match_tier") == "related"),
        sum(1 for r in enriched if r.get("match_tier") == "fallback"),
        total_count,
        raw_q[:80],
    )

    return MarketplaceSearchResult(
        vendors=enriched,
        match_notice=notice,
        has_exact=has_exact,
        has_related=has_related,
        total_count=total_count,
    )


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
