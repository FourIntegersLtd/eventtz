"""Admin: list and resolve problem reports between clients and vendors."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.bookings import (
    _client_emails_by_id,
    _vendor_display_names_by_id,
)
from app.features.bookings.dispute_commands import create_dispute_case
from app.features.realtime.sse import notify_user

from app.features.bookings.disputes import _resolve_conversation_id_for_dispute
from app.features.admin.team_ops import assert_active_admin_assignee

logger = get_logger(__name__)

__all__ = ["create_dispute_case", "enrich_dispute_row", "list_disputes_for_admin", "patch_dispute_case"]


def _same_user_id(a: str, b: str) -> bool:
    return bool(a and b and str(a).lower() == str(b).lower())


def _enrich_dispute_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return rows
    client = get_client()
    booking_ids = list({str(r.get("booking_request_id") or "") for r in rows if r.get("booking_request_id")})
    bookings_by_id: dict[str, dict[str, Any]] = {}
    if booking_ids:
        try:
            res = (
                client.table("booking_requests")
                .select("id,event_name,event_date,client_user_id,vendor_user_id,status,conversation_id")
                .in_("id", booking_ids)
                .execute()
            )
            for b in getattr(res, "data", None) or []:
                if isinstance(b, dict) and b.get("id"):
                    bookings_by_id[str(b["id"])] = b
        except Exception as e:
            logger.warning("_enrich_dispute_rows bookings failed: %s", e)

    user_ids: set[str] = set()
    for r in rows:
        oid = str(r.get("opened_by_user_id") or "")
        if oid:
            user_ids.add(oid)
        aid = str(r.get("assigned_admin_id") or "")
        if aid:
            user_ids.add(aid)
    for b in bookings_by_id.values():
        cid = str(b.get("client_user_id") or "")
        vid = str(b.get("vendor_user_id") or "")
        if cid:
            user_ids.add(cid)
        if vid:
            user_ids.add(vid)

    emails = _client_emails_by_id(list(user_ids)) if user_ids else {}
    vendor_ids = list(
        {str(b.get("vendor_user_id") or "") for b in bookings_by_id.values() if b.get("vendor_user_id")}
    )
    vnames = _vendor_display_names_by_id(vendor_ids) if vendor_ids else {}

    out: list[dict[str, Any]] = []
    for r in rows:
        row = dict(r)
        bid = str(row.get("booking_request_id") or "")
        booking = bookings_by_id.get(bid) or {}
        cid = str(booking.get("client_user_id") or "")
        vid = str(booking.get("vendor_user_id") or "")
        oid = str(row.get("opened_by_user_id") or "")
        aid = str(row.get("assigned_admin_id") or "")
        opened_role: str | None = None
        if _same_user_id(oid, cid):
            opened_role = "client"
        elif _same_user_id(oid, vid):
            opened_role = "vendor"
        client_email = emails.get(cid) if cid else None
        vendor_name = vnames.get(vid, "Vendor") if vid else None
        vendor_email = emails.get(vid) if vid else None
        opened_by_email = emails.get(oid) if oid else None
        opened_by_display: str | None = None
        if opened_role == "client":
            opened_by_display = (client_email or opened_by_email or "Client").strip()
        elif opened_role == "vendor":
            opened_by_display = (vendor_name or opened_by_email or "Vendor").strip()
        elif opened_by_email:
            opened_by_display = str(opened_by_email).strip()
        row["event_name"] = str(booking.get("event_name") or "") or None
        row["event_date"] = str(booking.get("event_date") or "") or None
        row["booking_status"] = str(booking.get("status") or "") or None
        row["client_email"] = client_email
        row["vendor_display_name"] = vendor_name
        row["vendor_email"] = vendor_email
        row["opened_by_role"] = opened_role
        row["opened_by_email"] = opened_by_email
        row["opened_by_display_name"] = opened_by_display or None
        row["assigned_admin_email"] = emails.get(aid) if aid else None
        dispute_conv = row.get("conversation_id")
        if not dispute_conv and booking:
            dispute_conv = _resolve_conversation_id_for_dispute(booking)
        row["conversation_id"] = str(dispute_conv).strip() if dispute_conv and str(dispute_conv).strip() else None
        out.append(row)
    return out


def enrich_dispute_row(row: dict[str, Any]) -> dict[str, Any]:
    """Attach booking and party labels for admin UI."""
    enriched = _enrich_dispute_rows([row])
    return enriched[0] if enriched else row


def list_disputes_for_admin(*, status: str | None = None) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    status_key = (status or "all").strip().lower()
    try:
        q = apply_recent_first_order(
            get_client().table("dispute_cases").select("*"),
        )
        if status_key == "open":
            q = q.in_("status", ["open", "under_review"])
        elif status_key in ("under_review", "resolved", "closed"):
            q = q.eq("status", status_key)
        elif status_key not in ("", "all"):
            raise ValueError("status must be all, open, under_review, resolved, or closed")
        res = q.limit(500).execute()
    except ValueError:
        raise
    except Exception as e:
        logger.warning("list_disputes_for_admin failed: %s", e, exc_info=True)
        return []
    out = []
    for r in getattr(res, "data", None) or []:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                "id": str(r.get("id", "")),
                "booking_request_id": str(r.get("booking_request_id", "")),
                "opened_by_user_id": str(r.get("opened_by_user_id", "")),
                "status": str(r.get("status", "open")),
                "summary": str(r.get("summary", "")),
                "internal_notes": r.get("internal_notes"),
                "resolution_note": r.get("resolution_note"),
                "assigned_admin_id": str(r["assigned_admin_id"])
                if r.get("assigned_admin_id")
                else None,
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
                "resolved_at": r.get("resolved_at"),
                "conversation_id": str(r["conversation_id"])
                if r.get("conversation_id")
                else None,
                "resolution_action": r.get("resolution_action"),
                "refund_amount_gbp": r.get("refund_amount_gbp"),
            },
        )
    return _enrich_dispute_rows(out)


def patch_dispute_case(
    dispute_id: str,
    *,
    status: str | None,
    internal_notes: str | None,
    resolution_note: str | None,
    assigned_admin_id: str | None,
    resolution_action: str | None = None,
    refund_amount_gbp: float | None = None,
) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    patch: dict[str, Any] = {}
    if status:
        patch["status"] = status
        if status in ("resolved", "closed"):
            patch["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if internal_notes is not None:
        patch["internal_notes"] = internal_notes
    if resolution_note is not None:
        patch["resolution_note"] = resolution_note
    if assigned_admin_id is not None:
        if assigned_admin_id:
            assert_active_admin_assignee(assigned_admin_id)
        patch["assigned_admin_id"] = assigned_admin_id or None
    if resolution_action is not None:
        patch["resolution_action"] = resolution_action
    if refund_amount_gbp is not None:
        patch["refund_amount_gbp"] = refund_amount_gbp
    if not patch:
        return None

    # Money movement happens before the DB patch: if Stripe fails we don't want to record a
    # resolution that never actually paid anyone out or refunded anyone.
    booking_request_id: str | None = None
    if status == "resolved" and resolution_action:
        existing = (
            get_client()
            .table("dispute_cases")
            .select("booking_request_id")
            .eq("id", dispute_id)
            .limit(1)
            .execute()
        )
        existing_rows = getattr(existing, "data", None) or []
        if existing_rows and isinstance(existing_rows[0], dict):
            booking_request_id = str(existing_rows[0].get("booking_request_id") or "") or None
        if not booking_request_id:
            raise ValueError("Dispute not found.")

        # Local import avoids a service-layer import cycle at module load time.
        from app.features.bookings.payments import (
            admin_refund_booking,
            admin_release_payout_for_booking,
        )

        if resolution_action == "release_to_vendor":
            admin_release_payout_for_booking(booking_request_id)
        elif resolution_action == "refund_client":
            admin_refund_booking(booking_request_id, amount_gbp=None)
        elif resolution_action == "partial_refund":
            if not refund_amount_gbp:
                raise ValueError("refund_amount_gbp is required for a partial refund.")
            booking_res = (
                get_client()
                .table("booking_requests")
                .select("payment_amount_gbp,payment_status")
                .eq("id", booking_request_id)
                .limit(1)
                .execute()
            )
            booking_rows = getattr(booking_res, "data", None) or []
            if not booking_rows or not isinstance(booking_rows[0], dict):
                raise ValueError("Booking not found.")
            booking_row = booking_rows[0]
            if str(booking_row.get("payment_status") or "") != "paid":
                raise ValueError("Only paid bookings can be partially refunded.")
            paid = booking_row.get("payment_amount_gbp")
            try:
                paid_amt = float(paid)
            except (TypeError, ValueError):
                paid_amt = 0.0
            if paid_amt <= 0:
                raise ValueError("No recorded payment amount for this booking.")
            if refund_amount_gbp <= 0 or refund_amount_gbp > paid_amt:
                raise ValueError(
                    f"Partial refund must be between 0 and GBP {paid_amt:.2f}.",
                )
            admin_refund_booking(booking_request_id, amount_gbp=refund_amount_gbp)

    try:
        res = (
            get_client()
            .table("dispute_cases")
            .update(patch)
            .eq("id", dispute_id)
            .execute()
        )
        data = getattr(res, "data", None) or []
        if not data:
            return None
        d = data[0] if isinstance(data, list) else data
        out = d if isinstance(d, dict) else None
        if not out:
            return None
        try:
            bid = str(out.get("booking_request_id") or "")
            if bid:
                b = (
                    get_client()
                    .table("booking_requests")
                    .select("client_user_id,vendor_user_id")
                    .eq("id", bid)
                    .limit(1)
                    .execute()
                )
                rows = getattr(b, "data", None) or []
                if rows and isinstance(rows[0], dict):
                    cid = str(rows[0].get("client_user_id") or "")
                    vid = str(rows[0].get("vendor_user_id") or "")
                    if cid:
                        notify_user(cid, "dispute_changed")
                    if vid:
                        notify_user(vid, "dispute_changed")
        except Exception:
            logger.warning("admin patch_dispute_case notify failed id=%s", dispute_id, exc_info=True)
        return out
    except Exception as e:
        logger.warning("patch_dispute_case failed: %s", e, exc_info=True)
        return None
