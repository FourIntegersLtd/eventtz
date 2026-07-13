"""Admin booking recovery actions (payment sync, payout, cancellation)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

import stripe

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.bookings.completion_rules import (
    compute_payout_auto_release_at,
    event_day_over,
)
from app.features.bookings.disputes import has_active_dispute_for_booking
from app.features.bookings.payments import (
    _finalize_booking_payment_from_checkout_session,
    _finalize_completion,
    _payment_fields_from_checkout_session,
    _serialize_completion_state,
    admin_release_payout_for_booking,
    refund_booking_on_cancel,
    touch_booking_completion_side_effects,
)
from app.features.bookings.status import _cancel_audit_fields, _guard_cancel_money_state
from app.features.payments import stripe as stripe_module

logger = get_logger(__name__)


def _load_booking_row(booking_id: str) -> dict[str, Any]:
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise ValueError("Invalid booking id.") from e
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        raise ValueError("Booking not found.")
    return rows[0]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def admin_clear_checkout_session(booking_id: str) -> dict[str, Any]:
    """Clear stale checkout session and return booking to unpaid."""
    if get_settings().local_auth_mode:
        raise ValueError("Not available in local auth mode.")
    row = _load_booking_row(booking_id)
    payment_status = str(row.get("payment_status") or "unpaid")
    if payment_status not in ("pending", "unpaid"):
        raise ValueError("Only unpaid or pending checkout bookings can be reset.")
    get_client().table("booking_requests").update(
        {
            "stripe_checkout_session_id": None,
            "payment_status": "unpaid",
        },
    ).eq("id", booking_id).execute()
    return _load_booking_row(booking_id)


def _mark_paid_from_payment_intent(row: dict[str, Any], pi_dict: dict[str, Any]) -> bool:
    booking_id = str(row.get("id") or "")
    pi_status = str(pi_dict.get("status") or "").lower()
    if pi_status not in ("succeeded", "requires_capture"):
        raise ValueError("Payment intent is not in a succeeded state.")

    metadata = pi_dict.get("metadata") or {}
    meta_booking = str(metadata.get("booking_id") or "").strip()
    if meta_booking and meta_booking != booking_id:
        raise ValueError("Payment intent does not match this booking.")

    amount_received = pi_dict.get("amount_received") or pi_dict.get("amount")
    if not isinstance(amount_received, (int, float)) or float(amount_received) <= 0:
        raise ValueError("Payment intent has no confirmed amount.")

    payment_intent_id = str(pi_dict.get("id") or "").strip()
    _, charge_id = _payment_fields_from_checkout_session({"payment_intent": pi_dict})
    payment_amount_gbp = float(amount_received) / 100.0

    vendor_amount_gbp = None
    platform_fee_gbp = None
    try:
        if metadata.get("vendor_amount_gbp") is not None:
            vendor_amount_gbp = float(metadata["vendor_amount_gbp"])
    except (TypeError, ValueError):
        vendor_amount_gbp = None
    try:
        if metadata.get("service_fee_gbp") is not None:
            platform_fee_gbp = float(metadata["service_fee_gbp"])
    except (TypeError, ValueError):
        platform_fee_gbp = None

    upd = (
        get_client()
        .table("booking_requests")
        .update(
            {
                "payment_status": "paid",
                "paid_at": _now_iso(),
                "stripe_payment_intent_id": payment_intent_id,
                "stripe_charge_id": charge_id,
                "payment_amount_gbp": payment_amount_gbp,
                "vendor_amount_gbp": vendor_amount_gbp,
                "platform_fee_gbp": platform_fee_gbp,
            },
        )
        .eq("id", booking_id)
        .eq("status", "accepted")
        .in_("payment_status", ["pending", "unpaid"])
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    return bool(updated)


def admin_sync_payment_for_booking(booking_id: str) -> dict[str, Any]:
    """Verify Stripe checkout session or payment intent and mark booking paid."""
    if get_settings().local_auth_mode:
        raise ValueError("Not available in local auth mode.")

    row = _load_booking_row(booking_id)
    payment_status = str(row.get("payment_status") or "unpaid")
    if payment_status in ("paid", "payout_released", "refunded", "partially_refunded"):
        return row

    if str(row.get("status") or "") != "accepted":
        raise ValueError("Only accepted bookings can be marked paid.")

    session_id = str(row.get("stripe_checkout_session_id") or "").strip()
    if session_id:
        try:
            session_raw = stripe_module.retrieve_checkout_session(session_id)
        except stripe.InvalidRequestError as e:
            code = str(getattr(e, "code", "") or "")
            if code == "resource_missing" or "checkout.session" in str(e).lower():
                admin_clear_checkout_session(booking_id)
                raise ValueError(
                    "Checkout session not found in Stripe. Checkout was reset — verify charge manually.",
                ) from e
            raise
        session = stripe_module.stripe_object_to_dict(session_raw)
        if str(session.get("payment_status") or "") == "paid":
            _finalize_booking_payment_from_checkout_session(session)
            refreshed = _load_booking_row(booking_id)
            if str(refreshed.get("payment_status") or "") in ("paid", "payout_released"):
                return refreshed

    pi_id = str(row.get("stripe_payment_intent_id") or "").strip()
    if not pi_id:
        raise ValueError("No checkout session or payment intent on file to sync.")

    pi_raw = stripe_module.retrieve_payment_intent(pi_id)
    pi_dict = pi_raw if isinstance(pi_raw, dict) else stripe_module.stripe_object_to_dict(pi_raw)
    if not _mark_paid_from_payment_intent(row, pi_dict):
        raise ValueError("Booking could not be marked paid — check status and payment state.")
    return _load_booking_row(booking_id)


def admin_retry_payout_for_booking(booking_id: str) -> dict[str, Any]:
    """Release vendor payout when paid and eligible (both confirmed or auto-release due)."""
    row = _load_booking_row(booking_id)
    payment_status = str(row.get("payment_status") or "")
    if payment_status != "paid":
        raise ValueError("Only paid bookings can have payout released.")
    if str(row.get("status") or "") != "accepted":
        raise ValueError("Booking must be accepted to release payout.")
    if has_active_dispute_for_booking(booking_id):
        raise ValueError("Open dispute blocks payout release.")

    client_conf = bool(row.get("client_completion_confirmed_at"))
    vendor_conf = bool(row.get("vendor_completion_confirmed_at"))
    release_at = compute_payout_auto_release_at(row)
    auto_due = bool(
        release_at
        and event_day_over(row)
        and datetime.now(timezone.utc) >= release_at,
    )
    if not (client_conf and vendor_conf) and not auto_due:
        raise ValueError(
            "Payout can only be released when both parties confirmed or auto-release is due.",
        )

    result = admin_release_payout_for_booking(booking_id)
    if result is None:
        raise ValueError("Booking not found.")
    refreshed = _load_booking_row(booking_id)
    if str(refreshed.get("payment_status") or "") != "payout_released":
        raise ValueError(
            "Payout was not released — vendor Stripe account may not be ready or transfer failed.",
        )
    return refreshed


def admin_complete_cancellation(booking_id: str) -> dict[str, Any]:
    """Flip status to cancelled when payment is already refunded."""
    row = _load_booking_row(booking_id)
    if str(row.get("payment_status") or "") != "refunded":
        raise ValueError("Only refunded bookings can be completed as cancelled.")
    if str(row.get("status") or "") != "accepted":
        raise ValueError("Booking is not in accepted + refunded state.")

    cancelled_by = str(row.get("cancelled_by") or "client")
    if cancelled_by not in ("client", "vendor"):
        cancelled_by = "client"

    upd = (
        get_client()
        .table("booking_requests")
        .update({"status": "cancelled", **_cancel_audit_fields(cancelled_by)})
        .eq("id", booking_id)
        .eq("status", "accepted")
        .eq("payment_status", "refunded")
        .execute()
    )
    if not getattr(upd, "data", None):
        raise ValueError("Could not complete cancellation.")
    return _load_booking_row(booking_id)


def admin_cancel_booking_on_behalf(
    booking_id: str,
    *,
    party: Literal["client", "vendor"],
    reason: str,
) -> dict[str, Any]:
    """Cancel and refund (if paid) on behalf of a party."""
    if not reason.strip():
        raise ValueError("Internal reason is required.")

    row = _load_booking_row(booking_id)
    status = str(row.get("status") or "")
    payment_status = str(row.get("payment_status") or "unpaid")

    if status == "completed":
        _guard_cancel_money_state(booking_id, status=status, payment_status=payment_status)
    if status not in ("pending", "accepted"):
        raise ValueError("Only pending or accepted bookings can be cancelled.")

    _guard_cancel_money_state(booking_id, status=status, payment_status=payment_status)

    if payment_status == "paid":
        refund_booking_on_cancel(booking_id, cancelled_by=party)
    elif payment_status == "refunded" and status == "accepted":
        return admin_complete_cancellation(booking_id)

    upd = (
        get_client()
        .table("booking_requests")
        .update({"status": "cancelled", **_cancel_audit_fields(party)})
        .eq("id", booking_id)
        .in_("status", ["pending", "accepted"])
        .execute()
    )
    if not getattr(upd, "data", None):
        raise ValueError("Could not cancel booking.")
    return _load_booking_row(booking_id)


def admin_confirm_completion_for_party(
    booking_id: str,
    *,
    party: Literal["client", "vendor"],
) -> dict[str, Any]:
    """Mark client or vendor completion confirmed on behalf of support."""
    row = _load_booking_row(booking_id)
    if str(row.get("status") or "") != "accepted":
        raise ValueError("Only accepted bookings can be marked complete.")
    if str(row.get("payment_status") or "") != "paid":
        raise ValueError("Payment must be completed before marking complete.")

    ts_col = "client_completion_confirmed_at" if party == "client" else "vendor_completion_confirmed_at"
    other_ts_col = "vendor_completion_confirmed_at" if party == "client" else "client_completion_confirmed_at"

    if row.get(ts_col):
        row = _load_booking_row(booking_id)
        if row.get(other_ts_col):
            return _finalize_completion(row)
        return _serialize_completion_state(row)

    upd = (
        get_client()
        .table("booking_requests")
        .update({ts_col: _now_iso()})
        .eq("id", booking_id)
        .is_(ts_col, "null")
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    if not updated:
        row = _load_booking_row(booking_id)
    else:
        row = updated[0] if isinstance(updated[0], dict) else row

    if not row.get(other_ts_col):
        touch_booking_completion_side_effects(row)
        return _serialize_completion_state(_load_booking_row(booking_id))

    return _finalize_completion(row)


def admin_run_booking_maintenance(booking_id: str) -> dict[str, Any]:
    """Run completion reminder + auto-release check for one booking."""
    row = _load_booking_row(booking_id)
    touch_booking_completion_side_effects(row)
    return _load_booking_row(booking_id)


def admin_set_support_hold(booking_id: str, *, hold: bool) -> dict[str, Any]:
    """Pause or resume automatic payout release."""
    _load_booking_row(booking_id)
    get_client().table("booking_requests").update({"support_hold": hold}).eq("id", booking_id).execute()
    return _load_booking_row(booking_id)
