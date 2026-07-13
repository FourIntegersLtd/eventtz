"""Booking money orchestration: Checkout, webhook capture, mutual-completion payout, refunds.

`booking_requests.status` (pending/accepted/declined/cancelled/completed) stays the request
lifecycle exactly as elsewhere in the app. `payment_status` (unpaid/pending/paid/refunded/
partially_refunded/payout_released) is the independent money lifecycle this module owns.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import stripe

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.payments import stripe as stripe_service
from app.core.db import get_db as get_client
from app.features.bookings.completion_rules import (
    compute_payout_auto_release_at,
    event_day_over,
)
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.bookings.pricing_refresh import refresh_booking_pricing
from app.features.bookings.queries import get_booking_request_for_client
from app.features.vendors.moderation import get_approved_vendor_payload
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

    vendor_payload = get_approved_vendor_payload(vendor_id)
    if not vendor_payload:
        raise ValueError(
            "This vendor is not available for booking right now.",
        )

    refreshed = refresh_booking_pricing(row, vendor_payload)
    line_items = refreshed["line_items"]
    pb = refreshed["pricing_breakdown"]

    db.table("booking_requests").update(
        {
            "line_items": line_items,
            "total_label": refreshed["total_label"],
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()

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


def _payment_fields_from_checkout_session(session: dict[str, Any]) -> tuple[str | None, str | None]:
    """Extract payment_intent id and charge id from a Checkout Session (expanded or not)."""
    pi_raw = session.get("payment_intent")
    payment_intent_id: str | None = None
    charge_id: str | None = None

    if isinstance(pi_raw, str) and pi_raw.strip():
        payment_intent_id = pi_raw.strip()
    elif isinstance(pi_raw, dict):
        pid = pi_raw.get("id")
        payment_intent_id = str(pid).strip() if pid else None
        latest_charge = pi_raw.get("latest_charge")
        if isinstance(latest_charge, dict):
            charge_id = latest_charge.get("id")
        elif isinstance(latest_charge, str):
            charge_id = latest_charge

    if payment_intent_id and not charge_id:
        try:
            pi = stripe_service.retrieve_payment_intent(payment_intent_id)
            pi_dict = pi if isinstance(pi, dict) else stripe_service.stripe_object_to_dict(pi)
            latest_charge = pi_dict.get("latest_charge")
            if isinstance(latest_charge, dict):
                charge_id = latest_charge.get("id")
            elif isinstance(latest_charge, str):
                charge_id = latest_charge
        except Exception:
            logger.exception("Failed to retrieve PaymentIntent %s", payment_intent_id)

    return payment_intent_id, charge_id


def _finalize_booking_payment_from_checkout_session(session: dict[str, Any]) -> bool:
    """Mark booking paid from a completed Checkout Session. Returns True if newly paid."""
    metadata = session.get("metadata") or {}
    booking_id = str(metadata.get("booking_id") or "").strip()
    if not booking_id:
        logger.warning(
            "checkout session missing booking_id metadata session=%s",
            session.get("id"),
        )
        return False

    session_id = str(session.get("id") or "").strip()
    db = get_client()
    existing_res = (
        db.table("booking_requests")
        .select("stripe_checkout_session_id,payment_status")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing_res, "data", None) or []
    if not existing_rows or not isinstance(existing_rows[0], dict):
        logger.warning("checkout session: booking %s not found", booking_id)
        return False
    booking_row = existing_rows[0]
    if str(booking_row.get("status") or "") != "accepted":
        logger.warning(
            "checkout session rejected: booking %s status=%s",
            booking_id,
            booking_row.get("status"),
        )
        return False

    stored_session = str(booking_row.get("stripe_checkout_session_id") or "").strip()
    if stored_session and session_id and stored_session != session_id:
        logger.warning(
            "checkout session rejected as stale booking=%s session=%s current=%s",
            booking_id,
            session_id,
            stored_session,
        )
        return False

    amount_total = session.get("amount_total")
    if not isinstance(amount_total, (int, float)):
        logger.warning("checkout session missing amount_total booking=%s", booking_id)
        return False

    expected_pence: int | None = None
    raw_client_total = metadata.get("client_total_gbp")
    if raw_client_total is not None:
        try:
            expected_pence = stripe_service._to_pence(float(raw_client_total))
        except (TypeError, ValueError):
            expected_pence = None
    if expected_pence is None:
        try:
            vendor_meta = float(metadata["vendor_amount_gbp"])
            fee_meta = float(metadata["service_fee_gbp"])
            expected_pence = stripe_service._to_pence(vendor_meta + fee_meta)
        except (TypeError, ValueError, KeyError):
            logger.warning("checkout session metadata missing pricing booking=%s", booking_id)
            return False

    if int(amount_total) != expected_pence:
        logger.warning(
            "checkout session amount mismatch booking=%s charged=%s expected=%s",
            booking_id,
            amount_total,
            expected_pence,
        )
        return False

    payment_intent_id, charge_id = _payment_fields_from_checkout_session(session)

    payment_amount_gbp = float(amount_total) / 100.0
    try:
        vendor_amount_gbp = float(metadata["vendor_amount_gbp"]) if metadata.get("vendor_amount_gbp") else None
    except (TypeError, ValueError):
        vendor_amount_gbp = None
    try:
        platform_fee_gbp = float(metadata["service_fee_gbp"]) if metadata.get("service_fee_gbp") else None
    except (TypeError, ValueError):
        platform_fee_gbp = None

    upd = (
        db.table("booking_requests")
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
    if not updated:
        logger.info(
            "checkout session: booking %s not eligible for payment (status/payment); skipping",
            booking_id,
        )
        return False
    row = updated[0] if isinstance(updated[0], dict) else {}
    client_id = str(row.get("client_user_id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    if client_id:
        upsert_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="payment_received",
            body=(
                "Payment received — we'll keep it safe until the event is done. "
                "After the event, confirm it went well and the vendor gets paid."
            ),
        )
    if vendor_id:
        upsert_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_payment_received",
            body=(
                "The client has paid. Confirm when the event is done to get paid — "
                "or you'll be paid automatically 48 hours after the event."
            ),
        )
    _notify_pair(client_id, vendor_id)
    return True


def handle_checkout_session_completed(event_id: str, session: dict[str, Any]) -> None:
    if not _mark_webhook_event_processed(event_id, "checkout.session.completed"):
        return
    _finalize_booking_payment_from_checkout_session(session)


def _clear_stale_checkout_session(booking_id: str, client_user_id: str) -> None:
    """Drop a checkout session id Stripe no longer knows (e.g. after switching Stripe accounts)."""
    get_client().table("booking_requests").update(
        {
            "stripe_checkout_session_id": None,
            "payment_status": "unpaid",
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).in_(
        "payment_status",
        ["pending", "unpaid"],
    ).execute()


def sync_checkout_payment_for_client(
    client_user_id: str,
    booking_id: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Verify a Stripe Checkout Session after redirect; marks booking paid if the webhook missed."""
    if get_settings().local_auth_mode:
        raise ValueError("Payments are not available in local auth mode.")

    row = get_booking_request_for_client(client_user_id, booking_id)
    if row is None:
        raise ValueError("Booking not found.")
    if str(row.get("status") or "") != "accepted":
        raise ValueError("This booking can no longer be paid.")

    payment_status = str(row.get("payment_status") or "unpaid")
    if payment_status in ("paid", "payout_released", "refunded", "partially_refunded"):
        return row

    resolved_session_id = (session_id or "").strip()
    if not resolved_session_id:
        session_res = (
            get_client()
            .table("booking_requests")
            .select("stripe_checkout_session_id")
            .eq("id", booking_id)
            .eq("client_user_id", client_user_id)
            .limit(1)
            .execute()
        )
        session_rows = getattr(session_res, "data", None) or []
        if session_rows and isinstance(session_rows[0], dict):
            resolved_session_id = str(session_rows[0].get("stripe_checkout_session_id") or "").strip()
    if not resolved_session_id:
        raise ValueError("No checkout session found for this booking.")

    try:
        session_raw = stripe_service.retrieve_checkout_session(resolved_session_id)
    except stripe.InvalidRequestError as e:
        code = str(getattr(e, "code", "") or "")
        if code == "resource_missing" or "checkout.session" in str(e).lower():
            logger.warning(
                "Stale checkout session booking=%s session=%s — clearing",
                booking_id,
                resolved_session_id,
            )
            _clear_stale_checkout_session(booking_id, client_user_id)
            raise ValueError(
                "That payment link has expired. Tap Pay now to start a fresh checkout.",
            ) from e
        raise

    session = stripe_service.stripe_object_to_dict(session_raw)

    metadata = session.get("metadata") or {}
    if str(metadata.get("booking_id") or "").strip() != booking_id:
        raise ValueError("This checkout session does not match this booking.")
    if str(metadata.get("client_user_id") or "").strip() != client_user_id:
        raise ValueError("This checkout session does not match your account.")

    if str(session.get("payment_status") or "") != "paid":
        raise ValueError("Payment has not finished processing yet. Wait a moment and refresh.")

    _finalize_booking_payment_from_checkout_session(session)

    refreshed = get_booking_request_for_client(client_user_id, booking_id)
    if refreshed is None:
        raise ValueError("Booking not found.")
    if str(refreshed.get("payment_status") or "") not in ("paid", "payout_released"):
        raise ValueError("Payment has not finished processing yet. Wait a moment and refresh.")
    return refreshed


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
                body=(
                    "The client confirmed the event went well. Confirm on your side to get paid."
                    if actor == "client"
                    else "The vendor confirmed the event is complete. Confirm on your side so they can be paid."
                ),
            )
        _notify_pair(client_id, vendor_id)
        touch_booking_completion_side_effects(row)
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


def _refund_paid_booking_row(
    row: dict[str, Any],
    *,
    amount_gbp: float | None,
    idempotency_suffix: str,
    refund_body: str,
) -> dict[str, Any]:
    """Issue a Stripe refund for a `paid` booking row and flip payment_status.

    Shared by admin dispute refunds and cancellation refunds. Raises ValueError
    (with a user-friendly message) when the refund cannot be issued — callers
    must not proceed with their own state changes in that case.
    """
    booking_id = str(row.get("id") or "")
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
            idempotency_suffix=idempotency_suffix,
        )
    except Exception as e:
        logger.exception("Stripe refund failed booking=%s", booking_id)
        raise ValueError("We couldn't process the refund right now. Please try again shortly.") from e

    new_status = "partially_refunded" if amount_gbp is not None else "refunded"
    upd = (
        get_client()
        .table("booking_requests")
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
            body=refund_body,
        )
    _notify_pair(client_id, vendor_id)
    return final_row


def refund_booking_on_cancel(booking_id: str, *, cancelled_by: str) -> dict[str, Any] | None:
    """Full refund when a paid booking is cancelled before the vendor is paid.

    Raises ValueError when the refund can't be issued — the caller must NOT
    cancel the booking in that case (money moves first, status second).
    """
    if get_settings().local_auth_mode:
        return None
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _refund_paid_booking_row(
        rows[0],
        amount_gbp=None,
        idempotency_suffix=f"cancel-{cancelled_by}",
        refund_body=(
            "This booking was cancelled. Your payment has been refunded in full — "
            "it should reach your card in 5-10 working days."
        ),
    )


def admin_refund_booking(booking_id: str, *, amount_gbp: float | None) -> dict[str, Any] | None:
    """Dispute resolution: refund_client (amount_gbp=None) or partial_refund (amount_gbp set)."""
    if get_settings().local_auth_mode:
        return None
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _refund_paid_booking_row(
        rows[0],
        amount_gbp=amount_gbp,
        idempotency_suffix="partial" if amount_gbp is not None else "full",
        refund_body="Your payment for this booking was refunded.",
    )


# --- Post-event auto-release + reminders (hourly maintenance cron) ---

LIST_COMPLETION_TOUCH_CAP = 10


def _format_release_date(release_at: datetime) -> str:
    """Human-readable release date (portable across platforms)."""
    return release_at.strftime("%A %d %B").replace(" 0", " ")


def maybe_send_completion_reminder_for_row(row: dict[str, Any]) -> bool:
    """Send one post-event nudge per booking to whoever hasn't confirmed yet."""
    if row.get("completion_reminder_sent_at"):
        return False
    if not event_day_over(row):
        return False
    booking_id = str(row.get("id") or "")
    client_id = str(row.get("client_user_id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    release_at = compute_payout_auto_release_at(row)
    release_label = _format_release_date(release_at) if release_at else "soon"
    if client_id and not row.get("client_completion_confirmed_at"):
        upsert_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="completion_reminder",
            body=(
                "How did your event go? If everything went well, confirm it's complete. "
                f"If something went wrong, report a problem before {release_label} — "
                "otherwise we'll pay the vendor automatically."
            ),
        )
    if vendor_id and not row.get("vendor_completion_confirmed_at"):
        upsert_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_completion_reminder",
            body=(
                "Confirm the event is complete to get paid sooner. If the client "
                f"doesn't respond, you'll be paid automatically on {release_label} "
                "unless they've reported a problem."
            ),
        )
    get_client().table("booking_requests").update(
        {"completion_reminder_sent_at": _now_iso()},
    ).eq("id", booking_id).execute()
    _notify_pair(client_id, vendor_id)
    return True


def touch_booking_completion_side_effects(row: dict[str, Any]) -> bool:
    """Per-booking: send post-event reminder (once), then try auto-release if due."""
    try:
        maybe_send_completion_reminder_for_row(row)
    except Exception:
        logger.exception("completion reminder failed booking=%s", row.get("id"))
    try:
        return _auto_release_payout_row(row)
    except ValueError:
        logger.warning("auto-release failed booking=%s", row.get("id"))
        return False
    except Exception:
        logger.exception("auto-release failed booking=%s", row.get("id"))
        return False


def touch_completion_side_effects_for_booking_rows(
    rows: list[dict[str, Any]],
    *,
    cap: int = LIST_COMPLETION_TOUCH_CAP,
) -> None:
    """Lazy backstop on list fetch: reminders + overdue payouts (capped per request)."""
    if get_settings().local_auth_mode:
        return
    touched = 0
    for row in rows:
        if touched >= cap:
            break
        if str(row.get("status") or "") != "accepted":
            continue
        if str(row.get("payment_status") or "") != "paid":
            continue
        if not event_day_over(row):
            continue
        touch_booking_completion_side_effects(row)
        touched += 1


def _auto_release_payout_row(row: dict[str, Any]) -> bool:
    """Release the payout for one booking if the auto-release window has passed.

    Returns True when the payout was released. Raises ValueError when the Stripe
    transfer fails (propagated from _finalize_completion).
    """
    # Local import: disputes.py imports the bookings package which loads this module.
    from app.features.bookings.disputes import has_active_dispute_for_booking

    booking_id = str(row.get("id") or "")
    if row.get("payout_auto_released_at"):
        return False
    release_at = compute_payout_auto_release_at(row)
    if release_at is None or datetime.now(timezone.utc) < release_at:
        return False
    if has_active_dispute_for_booking(booking_id):
        return False
    if row.get("support_hold"):
        return False
    result = _finalize_completion(row)
    if str((result or {}).get("payment_status") or "") != "payout_released":
        # e.g. vendor Stripe account not ready — leave for a later run.
        return False
    get_client().table("booking_requests").update(
        {"payout_auto_released_at": _now_iso()},
    ).eq("id", booking_id).execute()
    logger.info("payout auto-released booking=%s", booking_id)
    return True


def maybe_auto_release_payout_for_booking(booking_id: str) -> bool:
    """Backstop on booking detail fetch so users never see a stale overdue payout."""
    if get_settings().local_auth_mode:
        return False
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return False
    return touch_booking_completion_side_effects(rows[0])


def _due_completion_candidates(limit: int, *, extra_null_col: str) -> list[dict[str, Any]]:
    """Accepted + paid bookings whose event day has ended (incl. multi-day events)."""
    res = (
        get_client()
        .table("booking_requests")
        .select("*")
        .eq("status", "accepted")
        .eq("payment_status", "paid")
        .is_(extra_null_col, "null")
        .limit(limit * 3)
        .execute()
    )
    now = datetime.now(timezone.utc)
    eligible: list[dict[str, Any]] = []
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        if not event_day_over(row, now):
            continue
        eligible.append(row)
        if len(eligible) >= limit:
            break
    return eligible


def process_due_payout_auto_releases(limit: int = 50) -> int:
    """Hourly cron: pay vendors whose auto-release window has passed. Returns count released."""
    if get_settings().local_auth_mode:
        return 0
    released = 0
    for row in _due_completion_candidates(limit, extra_null_col="payout_auto_released_at"):
        try:
            if _auto_release_payout_row(row):
                released += 1
        except Exception:
            logger.exception("auto-release failed booking=%s", row.get("id"))
    return released


def send_completion_reminders(limit: int = 50) -> int:
    """Hourly cron: one post-event nudge per booking to whoever hasn't confirmed yet."""
    if get_settings().local_auth_mode:
        return 0
    sent = 0
    for row in _due_completion_candidates(limit, extra_null_col="completion_reminder_sent_at"):
        try:
            if maybe_send_completion_reminder_for_row(row):
                sent += 1
        except Exception:
            logger.exception("completion reminder failed booking=%s", row.get("id"))
    return sent
