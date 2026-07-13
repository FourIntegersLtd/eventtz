"""Admin booking list, detail, and payment field updates."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.bookings.list_order import sort_booking_rows_recent_first
from app.features.admin._helpers import opt_admin_ts
from app.features.admin.booking_payment_patch import patch_booking_payment_fields
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.bookings import (
    _attach_pricing_fields,
    _client_emails_by_id,
    _client_total_label_for_list,
    _normalize_date_str,
    _paid_at_iso,
    _vendor_display_names_by_id,
)
from app.features.bookings.reviews import (
    get_client_review_for_booking,
    get_vendor_review_for_booking,
)

from app.features.admin.booking_diagnostics import (
    compute_admin_booking_support_meta,
    summarize_support_for_booking_rows,
)

logger = get_logger(__name__)

_LIST_SELECT = (
    "id,status,event_name,event_date,event_end_date,client_user_id,vendor_user_id,created_at,updated_at,"
    "line_items,vendor_adjustments,paid_at,payment_status,stripe_payment_intent_id,stripe_checkout_session_id,"
    "stripe_transfer_id,support_hold,client_completion_confirmed_at,vendor_completion_confirmed_at,"
    "payout_auto_released_at"
)

_NEEDS_ATTENTION_SCAN_LIMIT = 400


def _booking_list_item(
    row: dict[str, Any],
    *,
    emails: dict[str, str | None],
    names: dict[str, str],
    support: dict[str, Any] | None,
) -> dict[str, Any]:
    cid = str(row.get("client_user_id") or "")
    vid = str(row.get("vendor_user_id") or "")
    li = row.get("line_items")
    if not isinstance(li, list):
        li = []
    va = row.get("vendor_adjustments")
    pb = build_pricing_breakdown(line_items=li, vendor_adjustments=va)
    return {
        "id": str(row.get("id", "")),
        "status": str(row.get("status", "")),
        "event_name": str(row.get("event_name", "")),
        "event_date": _normalize_date_str(row.get("event_date")),
        "client_email": emails.get(cid),
        "vendor_email": emails.get(vid),
        "vendor_display_name": names.get(vid, "Vendor"),
        "created_at": row.get("created_at"),
        "client_total_label": _client_total_label_for_list(pb),
        "paid_at": _paid_at_iso(row),
        "payment_status": str(row.get("payment_status") or "unpaid"),
        "support": support,
    }


def list_bookings_for_admin(
    *,
    offset: int = 0,
    limit: int = 50,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    needs_attention: bool = False,
) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    client = get_client()
    try:
        q = client.table("booking_requests").select(_LIST_SELECT, count="exact")
        if status and status.strip().lower() not in ("", "all"):
            q = q.eq("status", status.strip().lower())
        if date_from:
            q = q.gte("created_at", date_from)
        if date_to:
            q = q.lte("created_at", date_to)
        if search and search.strip():
            q = q.ilike("event_name", f"%{search.strip()}%")
        if needs_attention:
            q = apply_recent_first_order(q)
            res = q.limit(_NEEDS_ATTENTION_SCAN_LIMIT).execute()
            rows = sort_booking_rows_recent_first(
                [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)],
            )
            summaries = summarize_support_for_booking_rows(rows)
            rows = [r for r in rows if summaries.get(str(r.get("id") or ""), {}).get("needs_attention_count", 0) > 0]
            total = len(rows)
            rows = rows[offset : offset + limit]
        else:
            q = apply_recent_first_order(q)
            res = q.range(offset, offset + limit - 1).execute()
            rows = sort_booking_rows_recent_first(
                [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)],
            )
            total = int(getattr(res, "count", None) or len(rows))
    except Exception as e:
        logger.warning("list_bookings_for_admin failed: %s", e, exc_info=True)
        return [], 0

    cids = list({str(r.get("client_user_id") or "") for r in rows if r.get("client_user_id")})
    vids = list({str(r.get("vendor_user_id") or "") for r in rows if r.get("vendor_user_id")})
    emails = _client_emails_by_id([*cids, *vids])
    names = _vendor_display_names_by_id(vids)
    summaries = summarize_support_for_booking_rows(rows)

    out: list[dict[str, Any]] = []
    for row in rows:
        booking_id = str(row.get("id") or "")
        out.append(
            _booking_list_item(
                row,
                emails=emails,
                names=names,
                support=summaries.get(booking_id),
            ),
        )
    return out, total


def get_booking_detail_for_admin(booking_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        uuid.UUID(booking_id)
    except ValueError:
        return None
    res = (
        get_client()
        .table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    cid = str(row.get("client_user_id") or "")
    vid = str(row.get("vendor_user_id") or "")
    emails = _client_emails_by_id([cid, vid]) if cid or vid else {}
    names = _vendor_display_names_by_id([vid]) if vid else {}

    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []
    sel = row.get("selected_option_ids")
    selected_option_ids = [str(x) for x in sel] if isinstance(sel, list) else []
    ev_end = row.get("event_end_date")
    raw_adj = row.get("vendor_adjustments")
    if not isinstance(raw_adj, list):
        raw_adj = []

    ep = row.get("event_postcode")
    ea = row.get("event_address")
    out: dict[str, Any] = {
        "id": str(row.get("id", "")),
        "status": str(row.get("status", "pending")),
        "event_name": str(row.get("event_name", "")),
        "event_date": _normalize_date_str(row.get("event_date")),
        "event_end_date": _normalize_date_str(ev_end) if ev_end else None,
        "event_postcode": str(ep).strip() if ep else None,
        "event_address": str(ea).strip() if ea else None,
        "notes": row.get("notes"),
        "total_label": str(row.get("total_label", "")),
        "selected_option_ids": selected_option_ids,
        "line_items": line_items,
        "vendor_adjustments": raw_adj,
        "client_email": emails.get(cid),
        "vendor_email": emails.get(vid),
        "vendor_user_id": vid,
        "client_user_id": cid,
        "vendor_display_name": names.get(vid, "Vendor"),
        "created_at": row.get("created_at"),
        "paid_at": _paid_at_iso(row),
        "stripe_payment_intent_id": row.get("stripe_payment_intent_id"),
        "stripe_charge_id": row.get("stripe_charge_id"),
        "stripe_checkout_session_id": row.get("stripe_checkout_session_id"),
        "payment_amount_gbp": float(row["payment_amount_gbp"])
        if row.get("payment_amount_gbp") is not None
        else None,
        "payment_status": str(row.get("payment_status") or "unpaid"),
        "vendor_amount_gbp": float(row["vendor_amount_gbp"])
        if row.get("vendor_amount_gbp") is not None
        else None,
        "platform_fee_gbp": float(row["platform_fee_gbp"])
        if row.get("platform_fee_gbp") is not None
        else None,
        "stripe_transfer_id": row.get("stripe_transfer_id"),
        "payout_released_at": opt_admin_ts(row.get("payout_released_at")),
        "client_completion_confirmed_at": opt_admin_ts(row.get("client_completion_confirmed_at")),
        "vendor_completion_confirmed_at": opt_admin_ts(row.get("vendor_completion_confirmed_at")),
    }
    _attach_pricing_fields(out)
    out["review_vendor"] = get_vendor_review_for_booking(vid, booking_id) if vid else None
    out["review_client_summary"] = (
        get_client_review_for_booking(booking_id, cid) if cid else None
    )
    out["support"] = compute_admin_booking_support_meta(row)
    return out
