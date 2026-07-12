"""Booking money orchestration: Checkout, webhook capture, mutual-completion payout, refunds.

`booking_requests.status` (pending/accepted/declined/cancelled/completed) stays the request
lifecycle exactly as elsewhere in the app. `payment_status` (unpaid/pending/paid/refunded/
partially_refunded/payout_released) is the independent money lifecycle this module owns.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.payments import stripe as stripe_service
from app.core.db import get_db as get_client
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.notifications.service import (
    insert_booking_notification_if_absent,
    upsert_booking_notification,
)
from app.features.realtime.sse import notify_user

logger = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _notify_pair(client_user_id: str, vendor_user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    if client_user_id:
        notify_user(client_user_id, "booking_changed")
    if vendor_user_id:
        notify_user(vendor_user_id, "booking_changed")


def _get_vendor_stripe_fields(vendor_user_id: str) -> dict[str, Any] | None:
    res = (
        get_client()
        .table("vendors")
        .select("stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled")
        .eq("user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def create_checkout_session_for_booking(client_user_id: str, booking_id: str) -> str:
    """Validate + recompute pricing server-side, then return a Stripe Checkout URL."""
    if get_settings().local_auth_mode:
        raise ValueError("Payments are not available in local auth mode.")

    db = get_client()
    res = (
        db.table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        raise ValueError("Booking not found.")
    row = rows[0]

    if str(row.get("status") or "") != "accepted":
        raise ValueError("Only accepted bookings can be paid.")
    if str(row.get("payment_status") or "unpaid") not in ("unpaid", "pending"):
        raise ValueError("This booking has already been paid.")

    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    if not vendor_stripe.get("stripe_account_id") or not vendor_stripe.get("stripe_charges_enabled"):
        raise ValueError(
            "This vendor hasn't finished setting up payouts yet. Try again once they have.",
        )

    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []
    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=row.get("vendor_adjustments"))
    if pb.get("has_pricing_tbc"):
        raise ValueError("This booking still has prices to be confirmed before you can pay.")
    client_total = float(pb["client_total_gbp"])
    vendor_amount = float(pb["vendor_portion_gbp"])
    service_fee = float(pb["service_fee_gbp"])
    if client_total <= 0:
        raise ValueError("Nothing to pay for this booking.")

    ea = row.get("event_address")
    if not (isinstance(ea, str) and ea.strip()):
        raise ValueError(
            "Add your event address on the booking before paying. Your vendor needs it to prepare.",
        )

    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        client_total_gbp=client_total,
        vendor_amount_gbp=vendor_amount,
        service_fee_gbp=service_fee,
        vendor_user_id=vendor_id,
        client_user_id=client_user_id,
        description=str(row.get("event_name") or "Eventtz booking"),
    )
    db.table("booking_requests").update(
        {"stripe_checkout_session_id": session["id"], "payment_status": "pending"},
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()
    return session["url"]


def _mark_webhook_event_processed(event_id: str, event_type: str) -> bool:
    """True if this is the first time we've seen this event id (Stripe may redeliver)."""
    try:
        get_client().table("stripe_webhook_events").insert(
            {"id": event_id, "type": event_type},
        ).execute()
        return True
    except Exception as e:
        logger.info("stripe webhook event already processed id=%s type=%s (%s)", event_id, event_type, e)
        return False


def handle_checkout_session_completed(event_id: str, session: dict[str, Any]) -> None:
    if not _mark_webhook_event_processed(event_id, "checkout.session.completed"):
        return

    metadata = session.get("metadata") or {}
    booking_id = str(metadata.get("booking_id") or "").strip()
    if not booking_id:
        logger.warning("checkout.session.completed missing booking_id metadata session=%s", session.get("id"))
        return

    payment_intent_id = session.get("payment_intent")
    charge_id: str | None = None
    if payment_intent_id:
        try:
            pi = stripe_service.retrieve_payment_intent(str(payment_intent_id))
            latest_charge = pi.get("latest_charge") if isinstance(pi, dict) else pi["latest_charge"]
            if isinstance(latest_charge, dict):
                charge_id = latest_charge.get("id")
            elif isinstance(latest_charge, str):
                charge_id = latest_charge
        except Exception:
            logger.exception("Failed to retrieve PaymentIntent %s", payment_intent_id)

    amount_total = session.get("amount_total")
    payment_amount_gbp = (amount_total / 100.0) if isinstance(amount_total, (int, float)) else None
    try:
        vendor_amount_gbp = float(metadata["vendor_amount_gbp"]) if metadata.get("vendor_amount_gbp") else None
    except (TypeError, ValueError):
        vendor_amount_gbp = None
    try:
        platform_fee_gbp = float(metadata["service_fee_gbp"]) if metadata.get("service_fee_gbp") else None
    except (TypeError, ValueError):
        platform_fee_gbp = None

    db = get_client()
    upd = (
        db.table("booking_requests")
        .update(
            {
                "payment_status": "paid",
                "paid_at": _now_iso(),
                "stripe_payment_intent_id": str(payment_intent_id) if payment_intent_id else None,
                "stripe_charge_id": charge_id,
                "payment_amount_gbp": payment_amount_gbp,
                "vendor_amount_gbp": vendor_amount_gbp,
                "platform_fee_gbp": platform_fee_gbp,
            },
        )
        .eq("id", booking_id)
        .in_("payment_status", ["pending", "unpaid"])
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    if not updated:
        logger.info("checkout.session.completed: booking %s already paid; skipping", booking_id)
        return
    row = updated[0] if isinstance(updated[0], dict) else {}
    client_id = str(row.get("client_user_id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    if client_id:
        upsert_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="payment_received",
            body="Your payment was successful. The vendor has been notified.",
        )
    if vendor_id:
        upsert_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_payment_received",
            body="The client has paid for this booking. Funds will be released once the event is confirmed complete.",
        )
    _notify_pair(client_id, vendor_id)


def handle_account_updated(event_id: str, account: dict[str, Any]) -> None:
    if not _mark_webhook_event_processed(event_id, "account.updated"):
        return
    account_id = str(account.get("id") or "")
    if not account_id:
        return
    stripe_service.sync_connect_account_status_by_account_id(account_id)


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
    """Both parties have confirmed: mark completed and release the vendor payout."""
    db = get_client()
    booking_id = str(row.get("id") or "")
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
            upsert_booking_notification(
                user_id=vendor_id,
                booking_id=booking_id,
                kind="completion_confirmed_awaiting_other_party",
                body=(
                    "Both sides confirmed this booking is complete, but your payout account "
                    "isn't ready yet. Finish Stripe verification to receive the funds."
                ),
            )
        _notify_pair(client_id, vendor_id)
        return _serialize_completion_state(row)

    try:
        transfer_id = stripe_service.create_transfer(
            destination_account_id=str(vendor_stripe["stripe_account_id"]),
            amount_gbp=float(vendor_amount or 0),
            booking_id=booking_id,
        )
    except Exception as e:
        logger.exception("Stripe transfer failed booking=%s vendor=%s", booking_id, vendor_id)
        raise ValueError("We couldn't release the payout right now. Please try again shortly.") from e

    upd = (
        db.table("booking_requests")
        .update(
            {
                "status": "completed",
                "payment_status": "payout_released",
                "stripe_transfer_id": transfer_id,
                "payout_released_at": _now_iso(),
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

    if client_id:
        insert_booking_notification_if_absent(user_id=client_id, booking_id=booking_id, kind="booking_completed")
    if vendor_id:
        upsert_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_payout_released",
            body="Your payout for this booking has been released.",
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
            upsert_booking_notification(
                user_id=waiting_user,
                booking_id=booking_id,
                kind="completion_confirmed_awaiting_other_party",
                body="The other party marked this booking complete. Confirm on your side to release payout.",
            )
        _notify_pair(client_id, vendor_id)
        return _serialize_completion_state(row)

    return _finalize_completion(row)


def confirm_completion_for_client(client_user_id: str, booking_id: str) -> dict[str, Any] | None:
    return _confirm_completion(booking_id, actor="client", user_id=client_user_id)


def confirm_completion_for_vendor(vendor_user_id: str, booking_id: str) -> dict[str, Any] | None:
    return _confirm_completion(booking_id, actor="vendor", user_id=vendor_user_id)


def admin_release_payout_for_booking(booking_id: str) -> dict[str, Any] | None:
    """Dispute resolution: release_to_vendor. Skips the mutual-confirmation requirement."""
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


def admin_refund_booking(booking_id: str, *, amount_gbp: float | None) -> dict[str, Any] | None:
    """Dispute resolution: refund_client (amount_gbp=None) or partial_refund (amount_gbp set)."""
    if get_settings().local_auth_mode:
        return None
    db = get_client()
    res = db.table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    if str(row.get("payment_status") or "") != "paid":
        raise ValueError("Only paid bookings can be refunded.")
    pi_id = row.get("stripe_payment_intent_id")
    if not pi_id:
        raise ValueError("No payment on record for this booking.")

    try:
        stripe_service.create_refund(
            payment_intent_id=str(pi_id),
            booking_id=booking_id,
            amount_gbp=amount_gbp,
            idempotency_suffix="partial" if amount_gbp is not None else "full",
        )
    except Exception as e:
        logger.exception("Stripe refund failed booking=%s", booking_id)
        raise ValueError("We couldn't process the refund right now. Please try again shortly.") from e

    new_status = "partially_refunded" if amount_gbp is not None else "refunded"
    upd = (
        db.table("booking_requests")
        .update({"payment_status": new_status})
        .eq("id", booking_id)
        .eq("payment_status", "paid")
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    final_row = updated[0] if updated and isinstance(updated[0], dict) else {**row, "payment_status": new_status}

    client_id = str(final_row.get("client_user_id") or "")
    vendor_id = str(final_row.get("vendor_user_id") or "")
    if client_id:
        upsert_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="payment_refunded",
            body="Your payment for this booking was refunded.",
        )
    _notify_pair(client_id, vendor_id)
    return final_row
