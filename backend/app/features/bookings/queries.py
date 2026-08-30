"""Booking list and detail queries, with pricing and contact details added."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db
from app.features.bookings.completion_rules import (
    completion_waiting_on,
    compute_payout_auto_release_at,
)
from app.features.bookings.list_order import sort_booking_rows_recent_first
from app.features.bookings.pricing import persisted_booking_total_label
from app.features.vendor_referrals.booking_discount import (
    build_initial_pricing_breakdown_for_booking_row,
    build_pricing_breakdown_for_booking_row,
)
from app.features.bookings.pricing_confirmation import (
    client_price_confirmation_required,
    normalize_vendor_adjustments_list,
)
from app.features.bookings.reviews import (
    get_client_review_for_booking,
    get_client_reviewed_booking_ids,
    get_vendor_review_for_booking,
    get_vendor_reviews_for_bookings,
)
from app.features.settings.contact import (
    apply_counterparty_contact_visibility,
    mask_booking_list_client_email,
)
from app.features.bookings import messages as booking_messages
from app.features.bookings.create import ensure_client_booking_notes_in_chat

logger = get_logger(__name__)


def _backfill_notes_chat_on_detail(row: dict[str, Any], out: dict[str, Any]) -> None:
    """If the booking has client notes, make sure they appear in the message thread."""
    if _row_initiator(row) != "client":
        return
    notes = out.get("notes")
    if not isinstance(notes, str) or not notes.strip():
        return
    cid = str(row.get("client_user_id") or "").strip()
    vid = str(row.get("vendor_user_id") or "").strip()
    bid = str(out.get("id") or "").strip()
    if not cid or not vid or not bid:
        return
    linked = ensure_client_booking_notes_in_chat(
        booking_id=bid,
        client_user_id=cid,
        vendor_user_id=vid,
        notes=notes,
        conversation_id=out.get("conversation_id")
        if isinstance(out.get("conversation_id"), str)
        else None,
    )
    if linked:
        out["conversation_id"] = linked


def _row_initiator(row: dict[str, Any]) -> str:
    v = row.get("initiator")
    if v == "vendor":
        return "vendor"
    return "client"


def _paid_at_iso(row: dict[str, Any]) -> str | None:
    return _opt_ts(row.get("paid_at"))


def _opt_ts(v: Any) -> str | None:
    if v is None:
        return None
    return v if isinstance(v, str) else str(v)


def _auto_release_at_iso(row: dict[str, Any]) -> str | None:
    dt = compute_payout_auto_release_at(row)
    return dt.isoformat() if dt else None


def _normalize_date_str(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    return s[:10] if len(s) >= 10 else s


def _attach_pricing_fields(
    target: dict[str, Any],
    source: dict[str, Any] | None = None,
) -> None:
    """Add vendor_adjustments (normalised) and a pricing breakdown.

    Price from ``source`` (the DB row) when given. Projected API dicts often
    omit ``vendor_user_id``, which would skip the referral fee discount.
    """
    pb = build_pricing_breakdown_for_booking_row(source if source is not None else target)
    target["vendor_adjustments"] = pb["vendor_adjustments"]
    target["pricing"] = pb


def _initial_client_total_label(row: dict[str, Any], pb: dict[str, Any] | None = None) -> str | None:
    if _has_price_update(row):
        pre_adj = build_initial_pricing_breakdown_for_booking_row(row)
        computed = str(pre_adj.get("client_total_label") or "").strip()
        if computed:
            raw = row.get("initial_client_total_label")
            stored = str(raw).strip() if raw else ""
            if stored and stored == computed:
                return stored
            return computed

    raw = row.get("initial_client_total_label")
    if raw and str(raw).strip():
        return str(raw).strip()
    if pb and pb.get("client_total_label"):
        return str(pb["client_total_label"])
    ttl = row.get("total_label")
    return str(ttl).strip() if ttl else None


def _has_price_update(row: dict[str, Any]) -> bool:
    return len(normalize_vendor_adjustments_list(row.get("vendor_adjustments"))) > 0


def _list_has_price_update(row: dict[str, Any]) -> bool:
    """List badge: client must respond to a vendor price change on a pending enquiry."""
    return client_price_confirmation_required(row)


def _list_pricing_breakdown(row: dict[str, Any]) -> dict[str, Any]:
    bucket: dict[str, Any] = {}
    _attach_pricing_fields(bucket, source=row)
    return bucket["pricing"]


def _booking_detail_shared_fields(row: dict[str, Any]) -> dict[str, Any]:
    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []
    sel = row.get("selected_option_ids")
    selected_option_ids = [str(x) for x in sel] if isinstance(sel, list) else []
    raw_adj = row.get("vendor_adjustments")
    if not isinstance(raw_adj, list):
        raw_adj = []
    ev_end = row.get("event_end_date")
    ep = row.get("event_postcode")
    ea = row.get("event_address")
    conv = row.get("conversation_id")
    return {
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
        "created_at": row.get("created_at"),
        "paid_at": _paid_at_iso(row),
        "payment_status": str(row.get("payment_status") or "unpaid"),
        "client_completion_confirmed_at": _opt_ts(row.get("client_completion_confirmed_at")),
        "vendor_completion_confirmed_at": _opt_ts(row.get("vendor_completion_confirmed_at")),
        "payout_auto_release_at": _auto_release_at_iso(row),
        "completion_waiting_on": completion_waiting_on(row),
        "initiator": _row_initiator(row),
        "conversation_id": str(conv) if conv else None,
        "service_fee_percent": row.get("service_fee_percent"),
        "vendor_referral_code": row.get("vendor_referral_code"),
    }


def _client_total_label_for_list(pb: dict[str, Any]) -> str | None:
    if pb.get("has_pricing_tbc"):
        return None
    return str(pb.get("client_total_label") or "")


from app.features.auth.user_vendor_display_lookup import (
    client_display_names_by_id,
    client_emails_by_id,
    vendor_display_names_by_id,
)


def _vendor_display_names_by_id(vendor_ids: list[str]) -> dict[str, str]:
    return vendor_display_names_by_id(vendor_ids)


def _client_event_titles_by_id(event_ids: list[str]) -> dict[str, str]:
    ids = [e for e in event_ids if e]
    if not ids:
        return {}
    try:
        res = get_db().table("client_events").select("id,title").in_("id", ids).execute()
    except Exception as e:
        logger.warning("_client_event_titles_by_id failed: %s", e)
        return {}
    out: dict[str, str] = {}
    for row in getattr(res, "data", None) or []:
        if isinstance(row, dict) and row.get("id"):
            out[str(row["id"])] = str(row.get("title") or "")
    return out


def _client_emails_by_id(user_ids: list[str]) -> dict[str, str | None]:
    return client_emails_by_id(user_ids)


def list_booking_requests_for_vendor(
    vendor_user_id: str,
    *,
    group: str,
    status: str | None = None,
    payment_status: str | None = None,
    exclude_payment_status: str | None = None,
) -> list[dict[str, Any]]:
    """group: active (pending+accepted), completed, closed, or all.

    Optional `status` / `payment_status` / `exclude_payment_status` refine the query on the server.
    """
    if group not in ("active", "completed", "closed", "all"):
        raise ValueError(booking_messages.GROUP_INTERNAL)
    q = (
        get_db()
        .table("booking_requests")
        .select(
            "id,status,event_name,event_date,event_end_date,total_label,client_user_id,vendor_user_id,created_at,updated_at,line_items,vendor_adjustments,initiator,conversation_id,payment_status,client_completion_confirmed_at,vendor_completion_confirmed_at,completion_reminder_sent_at,service_fee_percent,vendor_referral_code",
        )
        .eq("vendor_user_id", vendor_user_id)
    )
    if group == "active":
        q = q.in_("status", ["pending", "accepted"])
    elif group == "completed":
        q = q.eq("status", "completed")
    elif group == "closed":
        q = q.in_("status", ["completed", "declined", "cancelled"])
    # group == "all": no status bucket filter

    if status:
        q = q.eq("status", status.strip().lower())
    if payment_status:
        q = q.eq("payment_status", payment_status.strip().lower())
    if exclude_payment_status:
        q = q.neq("payment_status", exclude_payment_status.strip().lower())

    res = apply_recent_first_order(q).execute()
    rows = sort_booking_rows_recent_first(
        [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)],
    )
    cids = [str(r["client_user_id"]) for r in rows if r.get("client_user_id")]
    emails = _client_emails_by_id(cids)
    display_names = client_display_names_by_id(cids)

    out: list[dict[str, Any]] = []
    for row in rows:
        cid = str(row.get("client_user_id") or "")
        ev_end = row.get("event_end_date")
        line_items = row.get("line_items")
        if not isinstance(line_items, list):
            line_items = []
        pb = _list_pricing_breakdown(row)
        conv = row.get("conversation_id")
        out.append(
            {
                "id": str(row.get("id", "")),
                "status": str(row.get("status", "pending")),
                "event_name": str(row.get("event_name", "")),
                "event_date": _normalize_date_str(row.get("event_date")),
                "event_end_date": _normalize_date_str(ev_end) if ev_end else None,
                "total_label": str(row.get("total_label", "")),
                "client_email": emails.get(cid),
                "client_display_name": display_names.get(cid),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "client_total_label": _client_total_label_for_list(pb),
                "initiator": _row_initiator(row),
                "conversation_id": str(conv) if conv else None,
                "payment_status": str(row.get("payment_status") or "unpaid"),
                "has_price_update": _list_has_price_update(row),
                "completion_waiting_on": completion_waiting_on(row),
                "vendor_completion_confirmed_at": _opt_ts(row.get("vendor_completion_confirmed_at")),
                # Used by list-touch completion reminders; stripped by response models.
                "client_user_id": cid,
                "vendor_user_id": vendor_user_id,
                "completion_reminder_sent_at": _opt_ts(row.get("completion_reminder_sent_at")),
            },
        )
    rev_map = get_vendor_reviews_for_bookings(vendor_user_id, [o["id"] for o in out])
    masked: list[dict[str, Any]] = []
    for o in out:
        o["review"] = rev_map.get(o["id"])
        masked.append(mask_booking_list_client_email(o))
    return masked


def get_booking_request_for_vendor(vendor_user_id: str, booking_id: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    cid = str(row.get("client_user_id") or "")
    emails = _client_emails_by_id([cid]) if cid else {}
    display_names = client_display_names_by_id([cid]) if cid else {}
    out = _booking_detail_shared_fields(row)
    out.update(
        {
            "client_user_id": cid or None,
            "client_email": emails.get(cid),
            "client_display_name": display_names.get(cid),
            "vendor_user_id": vendor_user_id,
        },
    )
    _attach_pricing_fields(out, source=row)
    out["initial_client_total_label"] = _initial_client_total_label(row, out.get("pricing"))
    bid = str(row.get("id", ""))
    out["review"] = get_vendor_review_for_booking(vendor_user_id, bid)
    _backfill_notes_chat_on_detail(row, out)
    return apply_counterparty_contact_visibility(
        viewer_role="vendor",
        booking_status=str(out.get("status") or ""),
        payment_status=str(out.get("payment_status") or "unpaid"),
        detail=out,
    )


def list_booking_requests_for_client(
    client_user_id: str,
    *,
    group: str,
    status: str | None = None,
    payment_status: str | None = None,
    exclude_payment_status: str | None = None,
) -> list[dict[str, Any]]:
    """group: active (pending+accepted), completed, closed, or all.

    Optional `status` / `payment_status` / `exclude_payment_status` refine the query on the server.
    """
    if group not in ("active", "completed", "closed", "all"):
        raise ValueError(booking_messages.GROUP_INTERNAL)
    q = (
        get_db()
        .table("booking_requests")
        .select(
            "id,status,event_name,event_date,event_end_date,total_label,vendor_user_id,created_at,updated_at,line_items,vendor_adjustments,initiator,conversation_id,payment_status,client_completion_confirmed_at,vendor_completion_confirmed_at,completion_reminder_sent_at,event_id,service_fee_percent,vendor_referral_code",
        )
        .eq("client_user_id", client_user_id)
    )
    if group == "active":
        q = q.in_("status", ["pending", "accepted"])
    elif group == "completed":
        q = q.eq("status", "completed")
    elif group == "closed":
        q = q.in_("status", ["completed", "declined", "cancelled"])

    if status:
        q = q.eq("status", status.strip().lower())
    if payment_status:
        q = q.eq("payment_status", payment_status.strip().lower())
    if exclude_payment_status:
        q = q.neq("payment_status", exclude_payment_status.strip().lower())

    res = apply_recent_first_order(q).execute()
    rows = sort_booking_rows_recent_first(
        [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)],
    )
    vids = [str(r["vendor_user_id"]) for r in rows if r.get("vendor_user_id")]
    names = _vendor_display_names_by_id(vids)
    completed_ids = [str(r["id"]) for r in rows if r.get("id") and r.get("status") == "completed"]
    reviewed_ids = (
        get_client_reviewed_booking_ids(client_user_id, completed_ids) if completed_ids else set()
    )

    event_ids = list(
        {
            str(r.get("event_id") or "")
            for r in rows
            if isinstance(r, dict) and r.get("event_id")
        },
    )
    event_titles = _client_event_titles_by_id(event_ids)

    out: list[dict[str, Any]] = []
    for row in rows:
        vid = str(row.get("vendor_user_id") or "")
        ev_end = row.get("event_end_date")
        line_items = row.get("line_items")
        if not isinstance(line_items, list):
            line_items = []
        pb = _list_pricing_breakdown(row)
        conv = row.get("conversation_id")
        eid = str(row.get("event_id") or "") or None
        out.append(
            {
                "id": str(row.get("id", "")),
                "status": str(row.get("status", "pending")),
                "event_name": str(row.get("event_name", "")),
                "event_date": _normalize_date_str(row.get("event_date")),
                "event_end_date": _normalize_date_str(ev_end) if ev_end else None,
                "total_label": str(row.get("total_label", "")),
                "client_total_label": _client_total_label_for_list(pb),
                "vendor_user_id": vid,
                "vendor_display_name": names.get(vid, "Vendor"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "initiator": _row_initiator(row),
                "conversation_id": str(conv) if conv else None,
                "event_id": eid,
                "event_title": event_titles.get(eid) if eid else None,
                "has_review": str(row.get("id", "")) in reviewed_ids,
                "payment_status": str(row.get("payment_status") or "unpaid"),
                "has_price_update": _list_has_price_update(row),
                "completion_waiting_on": completion_waiting_on(row),
                "client_completion_confirmed_at": _opt_ts(row.get("client_completion_confirmed_at")),
                # Used by list-touch completion reminders; stripped by response models.
                "client_user_id": client_user_id,
                "completion_reminder_sent_at": _opt_ts(row.get("completion_reminder_sent_at")),
            },
        )
    return out


def get_booking_request_for_client(client_user_id: str, booking_id: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    vid = str(row.get("vendor_user_id") or "")
    # Vendor display names omit GDPR tombstones via deleted_user_ids in display lookup.
    names = _vendor_display_names_by_id([vid]) if vid else {}
    eid = str(row.get("event_id") or "") or None
    event_titles = _client_event_titles_by_id([eid] if eid else [])
    out = _booking_detail_shared_fields(row)
    out.update(
        {
            "vendor_user_id": vid,
            "vendor_display_name": names.get(vid, "Vendor"),
            "event_id": eid,
            "event_title": event_titles.get(eid) if eid else None,
        },
    )
    _attach_pricing_fields(out, source=row)
    out["initial_client_total_label"] = _initial_client_total_label(row, out.get("pricing"))
    try:
        out["review"] = get_client_review_for_booking(booking_id, client_user_id)
    except Exception:
        out["review"] = None
    _backfill_notes_chat_on_detail(row, out)
    return apply_counterparty_contact_visibility(
        viewer_role="client",
        booking_status=str(out.get("status") or ""),
        payment_status=str(out.get("payment_status") or "unpaid"),
        detail=out,
    )
