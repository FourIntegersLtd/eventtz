"""Booking completion confirmation and vendor payout release."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.features.bookings.payment_shared import (
    _get_vendor_stripe_fields,
    _load_full_booking_row,
    _notify_pair,
    _now_iso,
    get_client,
    logger,
)
from app.features.email.dispatch import (
    dispatch_booking_notification,
    send_admin_payout_stuck_email,
)
from app.features.payments import stripe as stripe_service


def _serialize_completion_state(row: dict[str, Any]) -> dict[str, Any]:
    status = str(row.get("status") or "")
    client_confirmed = bool(row.get("client_completion_confirmed_at"))
    vendor_confirmed = bool(row.get("vendor_completion_confirmed_at"))
    return {
        "id": str(row.get("id") or ""),
        "status": status,
        "payment_status": str(row.get("payment_status") or ""),
        "awaiting_other_party": status != "completed" and (client_confirmed or vendor_confirmed),
    }


def _finalize_completion(row: dict[str, Any]) -> dict[str, Any]:
    """Both parties have confirmed: mark the booking completed and pay the vendor."""
    booking_id = str(row.get("id") or "")
    # Reload from the database — list and dashboard views omit vendor_amount_gbp and other payment fields.
    full = _load_full_booking_row(booking_id)
    if full is None:
        raise ValueError("Booking not found.")
    row = full

    db = get_client()
    client_id = str(row.get("client_user_id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_amount = row.get("vendor_amount_gbp")

    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    if not vendor_stripe.get("stripe_account_id") or not vendor_stripe.get("stripe_payouts_enabled"):
        logger.warning(
            "Cannot release payout booking=%s vendor=%s: Stripe payouts not enabled",
            booking_id,
            vendor_id,
        )
        if vendor_id:
            dispatch_booking_notification(
                user_id=vendor_id,
                booking_id=booking_id,
                kind="completion_confirmed_awaiting_other_party",
                body=(
                    "Both sides have confirmed this booking is complete, but your payout account "
                    "is not ready yet.\n\n"
                    "Please finish Stripe verification so we can release your funds."
                ),
            )
        _notify_pair(client_id, vendor_id)
        return _serialize_completion_state(row)

    try:
        amount_gbp = float(vendor_amount) if vendor_amount is not None else 0.0
    except (TypeError, ValueError):
        amount_gbp = 0.0
    if amount_gbp <= 0:
        hint = (
            f"vendor_amount_gbp is missing or zero (raw={vendor_amount!r}); "
            "cannot create a Stripe Transfer."
        )
        logger.error("Cannot release payout booking=%s: %s", booking_id, hint)
        send_admin_payout_stuck_email(
            booking_id=booking_id,
            vendor_user_id=vendor_id or None,
            error_hint=hint,
        )
        raise ValueError(
            "Payout amount is missing for this booking. Please contact support.",
        )

    try:
        # Checkout collects the full client payment on the platform; the vendor share stays
        # held until completion — Transfer moves that held balance to their Connect account.
        transfer_id = stripe_service.create_transfer(
            destination_account_id=str(vendor_stripe["stripe_account_id"]),
            amount_gbp=amount_gbp,
            booking_id=booking_id,
        )
    except Exception as e:
        logger.exception("Stripe transfer failed booking=%s vendor=%s", booking_id, vendor_id)
        send_admin_payout_stuck_email(
            booking_id=booking_id,
            vendor_user_id=vendor_id or None,
            error_hint=str(e)[:500],
        )
        raise ValueError("We couldn't release the payout right now. Please try again shortly.") from e

    upd = (
        db.table("booking_requests")
        .update(
            {
                "status": "completed",
                "payment_status": "payout_released",
                "stripe_transfer_id": transfer_id,
                "payout_released_at": _now_iso(),
                "completed_at": _now_iso(),
            },
        )
        .eq("id", booking_id)
        .eq("status", "accepted")
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    final_row = (
        updated[0]
        if updated and isinstance(updated[0], dict)
        else {**row, "status": "completed", "payment_status": "payout_released"}
    )

    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "booking_completed",
            vendor_user_id=vendor_id or None,
            booking_request_id=booking_id,
            booking_value_gbp=float(row.get("payment_amount_gbp") or amount_gbp or 0),
        )
    except Exception:
        pass

    if client_id:
        dispatch_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="booking_completed",
            mode="insert_if_absent",
        )
    if vendor_id:
        dispatch_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_payout_released",
            body="Your payout for this booking has been released.\n\nIt should arrive in your connected account shortly, depending on your bank. Thank you for completing this booking with Eventtz.",
        )
    _notify_pair(client_id, vendor_id)
    return _serialize_completion_state(final_row)


def _confirm_completion(booking_id: str, *, actor: str, user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    db = get_client()
    id_col = "client_user_id" if actor == "client" else "vendor_user_id"
    res = (
        db.table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .eq(id_col, user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]

    if str(row.get("status") or "") != "accepted":
        raise ValueError("Only accepted bookings can be marked complete.")
    if str(row.get("payment_status") or "") != "paid":
        raise ValueError("Payment must be completed before this booking can be marked complete.")

    ts_col = "client_completion_confirmed_at" if actor == "client" else "vendor_completion_confirmed_at"
    other_ts_col = "vendor_completion_confirmed_at" if actor == "client" else "client_completion_confirmed_at"

    if row.get(ts_col):
        return _serialize_completion_state(row)

    upd = (
        db.table("booking_requests")
        .update({ts_col: _now_iso()})
        .eq("id", booking_id)
        .eq(id_col, user_id)
        .is_(ts_col, "null")
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    if not updated:
        return None
    row = updated[0] if isinstance(updated[0], dict) else row

    if not row.get(other_ts_col):
        client_id = str(row.get("client_user_id") or "")
        vendor_id = str(row.get("vendor_user_id") or "")
        waiting_user = vendor_id if actor == "client" else client_id
        if waiting_user:
            dispatch_booking_notification(
                user_id=waiting_user,
                booking_id=booking_id,
                kind="completion_confirmed_awaiting_other_party",
                body=(
                    "The client confirmed the event went well.\n\n"
                    "Please confirm on your side to receive your payout."
                    if actor == "client"
                    else (
                        "The vendor confirmed the event is complete.\n\n"
                        "Please confirm on your side so they can be paid."
                    )
                ),
            )
        _notify_pair(client_id, vendor_id)
        from app.features.bookings.payment_maintenance import touch_booking_completion_side_effects

        touch_booking_completion_side_effects(row)
        return _serialize_completion_state(row)

    return _finalize_completion(row)


def confirm_completion_for_client(client_user_id: str, booking_id: str) -> dict[str, Any] | None:
    return _confirm_completion(booking_id, actor="client", user_id=client_user_id)


def confirm_completion_for_vendor(vendor_user_id: str, booking_id: str) -> dict[str, Any] | None:
    return _confirm_completion(booking_id, actor="vendor", user_id=vendor_user_id)


def admin_release_payout_for_booking(booking_id: str) -> dict[str, Any] | None:
    """Admin problem-report resolution: pay the vendor without waiting for both confirmations."""
    if get_settings().local_auth_mode:
        return None
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    if str(row.get("payment_status") or "") != "paid":
        raise ValueError("Only paid bookings can have their payout released.")
    return _finalize_completion(row)
