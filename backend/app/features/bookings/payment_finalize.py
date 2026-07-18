"""Checkout webhook handling and client-side payment sync."""

from __future__ import annotations

from typing import Any

import stripe

from app.core.config import get_settings
from app.features.bookings.payment_shared import (
    _notify_pair,
    _now_iso,
    get_client,
    logger,
)
from app.features.bookings.queries import get_booking_request_for_client
from app.features.email.dispatch import dispatch_booking_notification
from app.features.payments import stripe as stripe_service


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
    if pi_raw is not None and not isinstance(pi_raw, (str, dict)):
        pi_raw = stripe_service.stripe_object_to_dict(pi_raw)

    payment_intent_id: str | None = None
    charge_id: str | None = None

    if isinstance(pi_raw, str):
        text = pi_raw.strip()
        # Persist only bare Stripe ids — never stringified objects/blobs.
        if text.startswith("pi_") and len(text) < 255 and "{" not in text:
            payment_intent_id = text
    elif isinstance(pi_raw, dict):
        pid = pi_raw.get("id")
        if isinstance(pid, str) and pid.startswith("pi_"):
            payment_intent_id = pid
        latest_charge = pi_raw.get("latest_charge")
        if isinstance(latest_charge, dict):
            cid = latest_charge.get("id")
            charge_id = str(cid) if cid else None
        elif isinstance(latest_charge, str) and latest_charge.startswith("ch_"):
            charge_id = latest_charge

    if payment_intent_id and not charge_id:
        try:
            pi = stripe_service.retrieve_payment_intent(payment_intent_id)
            pi_dict = pi if isinstance(pi, dict) else stripe_service.stripe_object_to_dict(pi)
            latest_charge = pi_dict.get("latest_charge")
            if isinstance(latest_charge, dict):
                cid = latest_charge.get("id")
                charge_id = str(cid) if cid else None
            elif isinstance(latest_charge, str) and latest_charge.startswith("ch_"):
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
        .select("stripe_checkout_session_id,payment_status,status")
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
        dispatch_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="payment_received",
            body=(
                "Your payment was successful. Thank you.\n\n"
                "We will hold the funds safely until the event is complete. "
                "Afterwards, please confirm that everything went well so the vendor can be paid."
            ),
        )
    if vendor_id:
        dispatch_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_payment_received",
            body=(
                "The client has paid for this booking.\n\n"
                "Confirm when the event is done to receive your payout sooner. "
                "If you do not confirm, payment is released automatically 48 hours after the event "
                "unless a problem is reported. Thank you for your patience."
            ),
        )
    _notify_pair(client_id, vendor_id)
    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "customer_payment_completed",
            actor_user_id=client_id or None,
            vendor_user_id=vendor_id or None,
            booking_request_id=booking_id,
            booking_value_gbp=payment_amount_gbp,
        )
    except Exception:
        pass
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
