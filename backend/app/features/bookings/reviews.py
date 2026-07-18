"""Reviews linked to bookings (one per booking) for public vendor profiles."""

from __future__ import annotations

import re
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.auth.lookup import vendor_display_names_by_id

logger = get_logger(__name__)


def _reviewer_display_from_email(email: str | None) -> str:
    if not email or not isinstance(email, str):
        return "Verified client"
    local = email.split("@", 1)[0].strip()
    if not local:
        return "Verified client"
    local = re.sub(r"[^a-zA-Z0-9._-]", "", local)
    if not local:
        return "Verified client"
    return local[:1].upper() + local[1:18] if len(local) > 1 else local.upper()


def merge_review_stats_into_vendor_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add review_average and review_count to each row (ExploreVendorRow fields)."""
    if not rows:
        return rows
    ids = [str(r.get("user_id") or "") for r in rows if isinstance(r, dict) and r.get("user_id")]
    stats = get_review_stats_for_vendors(ids)
    for r in rows:
        if not isinstance(r, dict):
            continue
        uid = str(r.get("user_id") or "")
        s = stats.get(uid, {})
        r["review_average"] = s.get("average_rating")
        r["review_count"] = int(s.get("review_count") or 0)
    return rows


def featured_snippets_for_vendor_ids(
    vendor_ids: list[str],
    *,
    excerpt_max: int = 140,
    prefer_terms_by_vendor: dict[str, list[str]] | None = None,
) -> dict[str, dict[str, Any]]:
    """
    One public review snippet per vendor for plan cards.

    Prefers higher ratings and (when given) reviews whose body mentions the
    service the vendor was listed under — so a baker is less likely to show a
    catering-only quote.
    Returns { vendor_id: { rating, body_excerpt, reviewer_display } }.
    """
    ids = [str(v).strip() for v in vendor_ids if str(v).strip()]
    if not ids or get_settings().local_auth_mode:
        return {}

    client = get_client()
    try:
        q = apply_recent_first_order(
            client.table("booking_reviews")
            .select("rating, body, created_at, client_user_id, vendor_user_id")
            .in_("vendor_user_id", ids[:80]),
            column="created_at",
        ).limit(200)
        try:
            res = q.is_("hidden_at", "null").execute()
        except Exception:
            res = q.execute()
        rows = list(getattr(res, "data", None) or [])
    except Exception:
        logger.exception("featured_snippets_for_vendor_ids failed")
        return {}

    prefer = prefer_terms_by_vendor or {}
    best: dict[str, tuple[float, dict[str, Any]]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("vendor_user_id") or "")
        body = str(row.get("body") or "").strip()
        if not uid or not body:
            continue
        try:
            rating = int(row.get("rating") or 0)
        except (TypeError, ValueError):
            rating = 0
        if rating < 1:
            continue
        low = body.lower()
        terms = prefer.get(uid) or []
        term_hits = sum(1 for t in terms if t and t in low)
        # High rating first, then service-term fit, then a bit of length.
        score = rating * 10.0 + term_hits * 8.0 + min(len(body), 160) / 40.0
        prev = best.get(uid)
        if prev is not None and prev[0] >= score:
            continue
        excerpt = body if len(body) <= excerpt_max else body[: excerpt_max - 1].rstrip() + "…"
        best[uid] = (
            score,
            {
                "rating": rating,
                "body_excerpt": excerpt,
                "client_user_id": str(row.get("client_user_id") or ""),
            },
        )

    emails = _client_emails_for_review_rows(
        [{"client_user_id": v[1].get("client_user_id")} for v in best.values()],
    )
    out: dict[str, dict[str, Any]] = {}
    for uid, (_score, item) in best.items():
        cid = str(item.get("client_user_id") or "")
        out[uid] = {
            "rating": item["rating"],
            "body_excerpt": item["body_excerpt"],
            "reviewer_display": _reviewer_display_from_email(emails.get(cid)),
        }
    return out


def get_review_stats_for_vendors(vendor_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Returns { vendor_id: { review_count, average_rating } } for known ids."""
    if get_settings().local_auth_mode or not vendor_ids:
        return {}
    client = get_client()
    try:
        res = (
            client.table("vendor_review_stats")
            .select("vendor_user_id, review_count, average_rating")
            .in_("vendor_user_id", vendor_ids[:500])
            .execute()
        )
    except Exception as e:
        logger.warning("vendor_review_stats fetch failed: %s", e, exc_info=True)
        return {}
    out: dict[str, dict[str, Any]] = {}
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        vid = str(row.get("vendor_user_id") or "")
        if not vid:
            continue
        cnt = row.get("review_count")
        avg = row.get("average_rating")
        try:
            n = int(cnt) if cnt is not None else 0
        except (TypeError, ValueError):
            n = 0
        try:
            a = float(avg) if avg is not None else None
        except (TypeError, ValueError):
            a = None
        out[vid] = {"review_count": n, "average_rating": a}
    return out


_REVIEW_BASE_SELECT = "id, rating, body, created_at, client_user_id, booking_request_id"


def _fetch_vendor_review_rows(
    vendor_user_id: str,
    *,
    limit: int,
    public_only: bool = True,
) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    client = get_client()
    cap = min(max(limit, 1), 200 if not public_only else 100)
    try:
        q = (
            apply_recent_first_order(
                client.table("booking_reviews")
                .select(_REVIEW_BASE_SELECT)
                .eq("vendor_user_id", vendor_user_id),
                column="created_at",
            )
            .limit(cap)
        )
        if public_only:
            try:
                res = q.is_("hidden_at", "null").execute()
            except Exception:
                res = q.execute()
        else:
            res = q.execute()
    except Exception as e:
        logger.warning("_fetch_vendor_review_rows failed: %s", e, exc_info=True)
        return []
    return [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]


def _enrich_reviews_with_booking_context(
    rows: list[dict[str, Any]],
    *,
    include_total_label: bool = False,
) -> dict[str, dict[str, str]]:
    booking_ids = [
        str(r.get("booking_request_id") or "")
        for r in rows
        if isinstance(r, dict) and r.get("booking_request_id")
    ]
    event_by_booking: dict[str, dict[str, str]] = {}
    if not booking_ids:
        return event_by_booking
    sel = "id, event_name, event_date"
    if include_total_label:
        sel += ", total_label"
    try:
        br = (
            get_client()
            .table("booking_requests")
            .select(sel)
            .in_("id", booking_ids[:200])
            .execute()
        )
        for x in getattr(br, "data", None) or []:
            if isinstance(x, dict):
                bid = str(x.get("id") or "")
                if bid:
                    ctx: dict[str, str] = {
                        "event_name": str(x.get("event_name") or "Event"),
                        "event_date": str(x.get("event_date") or "")[:10],
                    }
                    if include_total_label:
                        ctx["total_label"] = str(x.get("total_label") or "")
                    event_by_booking[bid] = ctx
    except Exception as e:
        logger.warning("booking_requests join for reviews failed: %s", e, exc_info=True)
    return event_by_booking


def _client_emails_for_review_rows(rows: list[dict[str, Any]]) -> dict[str, str]:
    client_ids = list(
        {str(r.get("client_user_id") or "") for r in rows if isinstance(r, dict) and r.get("client_user_id")}
    )
    emails: dict[str, str] = {}
    if not client_ids:
        return emails
    try:
        ur = (
            get_client()
            .table("users")
            .select("id, email")
            .in_("id", client_ids[:200])
            .execute()
        )
        for x in getattr(ur, "data", None) or []:
            if isinstance(x, dict):
                uid = str(x.get("id") or "")
                if uid:
                    emails[uid] = str(x.get("email") or "")
    except Exception as e:
        logger.warning("users fetch for review labels failed: %s", e, exc_info=True)
    return emails


def _vendor_review_items_from_rows(
    rows: list[dict[str, Any]],
    event_by_booking: dict[str, dict[str, str]],
    emails: dict[str, str],
    *,
    include_booking_id: bool = False,
) -> list[dict[str, Any]]:
    out_list: list[dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        bid = str(r.get("booking_request_id") or "")
        cid = str(r.get("client_user_id") or "")
        ev = event_by_booking.get(bid, {})
        item: dict[str, Any] = {
            "id": str(r.get("id", "")),
            "rating": int(r.get("rating") or 0),
            "body": str(r.get("body") or ""),
            "created_at": r.get("created_at"),
            "reviewer_display": _reviewer_display_from_email(emails.get(cid)),
            "event_name": ev.get("event_name", "Event"),
            "event_date": ev.get("event_date", ""),
            "booking_total_label": ev.get("total_label", ""),
        }
        if include_booking_id:
            item["booking_request_id"] = bid
        out_list.append(item)
    return out_list


def list_public_reviews_for_vendor(
    vendor_user_id: str,
    *,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Returns (reviews, summary) where summary is { average_rating, review_count }.
    """
    if get_settings().local_auth_mode:
        return [], {"average_rating": None, "review_count": 0}

    client = get_client()
    stats = get_review_stats_for_vendors([vendor_user_id])
    sm = stats.get(vendor_user_id) or {"review_count": 0, "average_rating": None}
    summary = {
        "average_rating": sm.get("average_rating"),
        "review_count": int(sm.get("review_count") or 0),
    }

    rows = _fetch_vendor_review_rows(vendor_user_id, limit=limit, public_only=True)
    event_by_booking = _enrich_reviews_with_booking_context(rows, include_total_label=True)
    emails = _client_emails_for_review_rows(rows)
    return _vendor_review_items_from_rows(rows, event_by_booking, emails), summary


def list_reviews_for_vendor_owner(
    vendor_user_id: str,
    *,
    limit: int = 100,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Visible client reviews for the authenticated vendor (matches public profile)."""
    if get_settings().local_auth_mode:
        return [], {
            "average_rating": None,
            "review_count": 0,
        }

    client = get_client()
    stats = get_review_stats_for_vendors([vendor_user_id])
    sm = stats.get(vendor_user_id) or {"review_count": 0, "average_rating": None}
    summary = {
        "average_rating": sm.get("average_rating"),
        "review_count": int(sm.get("review_count") or 0),
    }

    rows = _fetch_vendor_review_rows(vendor_user_id, limit=limit, public_only=True)
    event_by_booking = _enrich_reviews_with_booking_context(rows, include_total_label=True)
    emails = _client_emails_for_review_rows(rows)
    return _vendor_review_items_from_rows(
        rows, event_by_booking, emails, include_booking_id=True
    ), summary


def list_reviews_for_client(
    client_user_id: str,
    *,
    limit: int = 100,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Reviews this client has submitted."""
    if get_settings().local_auth_mode:
        return [], {"review_count": 0}

    client = get_client()
    sel = "id, rating, body, created_at, vendor_user_id, booking_request_id"

    try:
        res = (
            apply_recent_first_order(
                client.table("booking_reviews")
                .select(sel)
                .eq("client_user_id", client_user_id),
                column="created_at",
            )
            .limit(min(max(limit, 1), 200))
            .execute()
        )
    except Exception as e:
        logger.warning("list_reviews_for_client failed: %s", e, exc_info=True)
        return [], {"review_count": 0}

    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    summary = {"review_count": len(rows)}

    vendor_ids = list({str(r.get("vendor_user_id") or "") for r in rows if r.get("vendor_user_id")})
    vendor_names = vendor_display_names_by_id(vendor_ids) if vendor_ids else {}
    event_by_booking = _enrich_reviews_with_booking_context(rows, include_total_label=False)

    out_list: list[dict[str, Any]] = []
    for r in rows:
        bid = str(r.get("booking_request_id") or "")
        vid = str(r.get("vendor_user_id") or "")
        ev = event_by_booking.get(bid, {})
        out_list.append(
            {
                "id": str(r.get("id", "")),
                "rating": int(r.get("rating") or 0),
                "body": str(r.get("body") or ""),
                "created_at": r.get("created_at"),
                "booking_request_id": bid,
                "vendor_user_id": vid,
                "vendor_display_name": vendor_names.get(vid, "Vendor"),
                "event_name": ev.get("event_name", "Event"),
                "event_date": ev.get("event_date", ""),
            },
        )

    return out_list, summary


def get_vendor_reviews_for_bookings(
    vendor_user_id: str,
    booking_ids: list[str],
) -> dict[str, dict[str, Any]]:
    """
    Map booking_request_id -> review fields for the vendor (client-authored reviews).
    """
    if get_settings().local_auth_mode or not vendor_user_id or not booking_ids:
        return {}
    ids = list({str(b) for b in booking_ids if b})
    if not ids:
        return {}
    client = get_client()
    try:
        q = (
            client.table("booking_reviews")
            .select(
                "id, rating, body, created_at, client_user_id, booking_request_id",
            )
            .eq("vendor_user_id", vendor_user_id)
            .in_("booking_request_id", ids[:300])
        )
        try:
            res = q.is_("hidden_at", "null").execute()
        except Exception:
            res = q.execute()
    except Exception as e:
        logger.warning("get_vendor_reviews_for_bookings failed: %s", e, exc_info=True)
        return {}

    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    if not rows:
        return {}

    cids = list({str(r.get("client_user_id") or "") for r in rows if r.get("client_user_id")})
    emails = _client_emails_for_review_rows(rows) if cids else {}

    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        bid = str(r.get("booking_request_id") or "")
        if not bid:
            continue
        cid = str(r.get("client_user_id") or "")
        try:
            rt = int(r.get("rating") or 0)
        except (TypeError, ValueError):
            rt = 0
        rt = max(1, min(5, rt))
        out[bid] = {
            "id": str(r.get("id", "")),
            "rating": rt,
            "body": str(r.get("body") or ""),
            "created_at": r.get("created_at"),
            "reviewer_display": _reviewer_display_from_email(emails.get(cid)),
        }
    return out


def get_vendor_review_for_booking(vendor_user_id: str, booking_id: str) -> dict[str, Any] | None:
    m = get_vendor_reviews_for_bookings(vendor_user_id, [booking_id])
    return m.get(booking_id)


def get_client_reviewed_booking_ids(client_user_id: str, booking_ids: list[str]) -> set[str]:
    """Which booking ids this client has already reviewed — avoids an extra query per booking."""
    if get_settings().local_auth_mode or not client_user_id:
        return set()
    ids = list({str(b) for b in booking_ids if b})
    if not ids:
        return set()
    client = get_client()
    try:
        res = (
            client.table("booking_reviews")
            .select("booking_request_id")
            .eq("client_user_id", client_user_id)
            .in_("booking_request_id", ids[:300])
            .execute()
        )
    except Exception as e:
        logger.warning("get_client_reviewed_booking_ids failed: %s", e, exc_info=True)
        return set()
    return {
        str(r["booking_request_id"])
        for r in (getattr(res, "data", None) or [])
        if isinstance(r, dict) and r.get("booking_request_id")
    }


def get_client_review_for_booking(booking_id: str, client_user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    client = get_client()
    try:
        res = (
            client.table("booking_reviews")
            .select("id, rating, body, created_at")
            .eq("booking_request_id", booking_id)
            .eq("client_user_id", client_user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_client_review_for_booking failed: %s", e, exc_info=True)
        return None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    return {
        "id": str(row.get("id", "")),
        "rating": int(row.get("rating") or 0),
        "body": str(row.get("body") or ""),
        "created_at": row.get("created_at"),
    }


def create_booking_review(
    *,
    client_user_id: str,
    booking_id: str,
    rating: int,
    body: str,
) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        raise ValueError("Reviews are unavailable in local auth mode.")

    client = get_client()
    res = (
        client.table("booking_requests")
        .select("id, status, client_user_id, vendor_user_id")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ValueError("Booking not found.")
    row = data[0]
    if str(row.get("client_user_id") or "") != client_user_id:
        raise ValueError("Booking not found.")
    if str(row.get("status") or "") != "completed":
        raise ValueError("You can only review a booking after it is marked complete.")
    vendor_id = str(row.get("vendor_user_id") or "")
    if not vendor_id:
        raise ValueError("Invalid booking.")

    dup = (
        client.table("booking_reviews")
        .select("id")
        .eq("booking_request_id", booking_id)
        .limit(1)
        .execute()
    )
    if getattr(dup, "data", None):
        raise ValueError("You have already submitted a review for this booking.")

    text = body.strip()
    if len(text) < 10:
        raise ValueError("Review must be at least 10 characters.")
    if len(text) > 4000:
        raise ValueError("Review is too long.")

    client.table("booking_reviews").insert(
        {
            "booking_request_id": booking_id,
            "vendor_user_id": vendor_id,
            "client_user_id": client_user_id,
            "rating": rating,
            "body": text,
        },
    ).execute()

    fetch = (
        client.table("booking_reviews")
        .select("id, rating, body, created_at")
        .eq("booking_request_id", booking_id)
        .limit(1)
        .execute()
    )
    ins_data = getattr(fetch, "data", None) or []
    if not ins_data or not isinstance(ins_data[0], dict):
        raise ValueError("Could not save review.")

    created = ins_data[0]
    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "review_submitted",
            actor_user_id=client_user_id,
            vendor_user_id=vendor_id,
            booking_request_id=booking_id,
            payload={"rating": rating},
        )
    except Exception:
        pass
    return {
        "id": str(created.get("id", "")),
        "rating": int(created.get("rating") or rating),
        "body": text,
        "created_at": created.get("created_at"),
    }
