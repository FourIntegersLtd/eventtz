"""Booking status transitions for client and vendor."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import one_row, rows
from app.core.db import get_db as get_client
from app.features.bookings._command_helpers import normalize_event_postcode_accept
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.pricing_confirmation import client_price_confirmation_required
from app.features.bookings.queries import (
    _row_initiator,
    get_booking_request_for_client,
    get_booking_request_for_vendor,
)
from app.features.email.dispatch import dispatch_booking_notification


def _guard_cancel_money_state(booking_id: str, *, status: str, payment_status: str) -> None:
    """Shared cancel guards: no cancelling after payout, none mid-dispute."""
    if status == "completed":
        raise ValueError(
            "This booking is already complete, so it can't be cancelled. "
            "If something went wrong, report a problem instead.",
        )
    if payment_status == "payout_released":
        raise ValueError(
            "The vendor has already been paid for this booking, so it can't be "
            "cancelled. If something went wrong, report a problem instead.",
        )
    if payment_status == "partially_refunded":
        raise ValueError(
            "This booking has a partial refund on record, so it can't be cancelled. "
            "Contact support if you need help.",
        )
    if payment_status == "refunded" and status != "accepted":
        raise ValueError("This booking has already been refunded.")
    # Local import: disputes.py imports the bookings package, which imports this module.
    from app.features.bookings.disputes import has_active_dispute_for_booking

    if has_active_dispute_for_booking(booking_id):
        raise ValueError(
            "This booking has an open problem report. It can't be cancelled until "
            "that's resolved.",
        )


def _refund_paid_booking_for_cancel(booking_id: str, payment_status: str, *, cancelled_by: str) -> bool:
    """Full refund before cancelling a paid booking. Returns True if a refund was issued."""
    if payment_status != "paid":
        return False
    # Local import to avoid a circular import at module load.
    from app.features.bookings.payments import refund_booking_on_cancel

    refund_booking_on_cancel(booking_id, cancelled_by=cancelled_by)
    return True


def _cancel_audit_fields(cancelled_by: str) -> dict[str, str]:
    return {
        "cancelled_by": cancelled_by,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }


def update_booking_request_status_for_vendor(
    vendor_user_id: str,
    booking_id: str,
    *,
    new_status: str,
) -> dict[str, Any] | None:
    """Vendor transitions: pending→accepted/declined; declined→accepted; accepted→cancelled."""
    if new_status not in ("accepted", "declined", "cancelled"):
        raise ValueError("Status must be accepted, declined, or cancelled.")
    if get_settings().local_auth_mode:
        return None

    client = get_client()
    res = (
        client.table("booking_requests")
        .select("id,status,client_user_id,initiator,paid_at,payment_status,vendor_adjustments")
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    row0 = one_row(res)
    if row0 is None:
        return None
    current = str(row0.get("status", ""))
    client_uid = str(row0.get("client_user_id") or "")
    payment_status = str(row0.get("payment_status") or "")
    initiator = _row_initiator(row0)

    if new_status == "cancelled":
        if current == "accepted":
            _guard_cancel_money_state(booking_id, status=current, payment_status=payment_status)
            refunded = _refund_paid_booking_for_cancel(
                booking_id,
                payment_status,
                cancelled_by="vendor",
            )
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled", **_cancel_audit_fields("vendor")})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "accepted")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                if refunded:
                    dispatch_booking_notification(
                        user_id=client_uid,
                        booking_id=booking_id,
                        kind="booking_cancelled_by_vendor",
                        body=(
                            "The vendor cancelled this booking. Your payment has been "
                            "refunded in full — it should reach your card in 5-10 working days."
                        ),
                    )
                else:
                    dispatch_booking_notification(
                        user_id=client_uid,
                        booking_id=booking_id,
                        kind="booking_cancelled_by_vendor",
                        mode="insert_if_absent",
                    )
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "cancelled"}
        if current == "pending" and initiator == "vendor":
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled", **_cancel_audit_fields("vendor")})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                dispatch_booking_notification(
                    user_id=client_uid,
                    booking_id=booking_id,
                    kind="vendor_quote_withdrawn",
                    body="The vendor withdrew this quote.",
                )
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "cancelled"}
        raise ValueError(
            "Cancel is only for accepted bookings or withdrawing a pending vendor quote.",
        )

    if new_status == "accepted":
        if initiator == "vendor":
            raise ValueError("The client must accept a vendor quote.")
        if current == "pending":
            if client_price_confirmation_required(row0):
                raise ValueError(
                    "The client must confirm the updated price before you can accept this booking.",
                )
            upd = (
                client.table("booking_requests")
                .update({"status": "accepted"})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                _notify_client_booking_accepted(client_uid, booking_id)
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "accepted"}
        if current == "declined":
            upd = (
                client.table("booking_requests")
                .update({"status": "accepted"})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "declined")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                _notify_client_booking_accepted(client_uid, booking_id)
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "accepted"}
        raise ValueError(
            "Accept is only available for pending requests or previously rejected requests.",
        )

    if new_status == "declined":
        if initiator == "vendor":
            raise ValueError("Withdraw a quote you sent using cancel instead of reject.")
        if current != "pending":
            raise ValueError("Only pending requests can be declined.")
        upd = (
            client.table("booking_requests")
            .update({"status": "declined"})
            .eq("id", booking_id)
            .eq("vendor_user_id", vendor_user_id)
            .eq("status", "pending")
            .execute()
        )
        if not rows(upd):
            return None
        if client_uid:
            dispatch_booking_notification(
                user_id=client_uid,
                booking_id=booking_id,
                kind="booking_declined_by_vendor",
                body="The vendor declined this booking request.",
            )
        _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
        return {"id": booking_id, "status": "declined"}

    raise ValueError("Unsupported status transition.")


def _notify_client_booking_accepted(client_uid: str, booking_id: str) -> None:
    full = get_booking_request_for_client(client_uid, booking_id)
    if not full:
        return
    pricing = full.get("pricing") if isinstance(full.get("pricing"), dict) else {}
    ttl = str(pricing.get("client_total_label") or full.get("total_label") or "")
    adj = full.get("vendor_adjustments")
    adj_list = adj if isinstance(adj, list) else []
    body = _client_booking_pricing_explanation_body(
        lead_sentence="Your booking was accepted.",
        total_label=ttl,
        adjustments=adj_list,
    )
    dispatch_booking_notification(
        user_id=client_uid,
        booking_id=booking_id,
        kind="booking_accepted",
        body=body,
    )


def cancel_booking_request_for_client(
    client_user_id: str,
    booking_id: str,
) -> dict[str, Any] | None:
    """Client cancels a pending or accepted booking."""
    if get_settings().local_auth_mode:
        return None

    db = get_client()
    res = (
        db.table("booking_requests")
        .select("id,status,vendor_user_id,payment_status")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row0 = one_row(res)
    if row0 is None:
        return None
    current = str(row0.get("status", ""))
    vendor_uid = str(row0.get("vendor_user_id") or "")
    payment_status = str(row0.get("payment_status") or "")
    if current == "completed":
        _guard_cancel_money_state(booking_id, status=current, payment_status=payment_status)
    if current not in ("pending", "accepted"):
        raise ValueError("Only pending or accepted bookings can be cancelled.")

    _guard_cancel_money_state(booking_id, status=current, payment_status=payment_status)
    refunded = _refund_paid_booking_for_cancel(booking_id, payment_status, cancelled_by="client")

    upd = (
        db.table("booking_requests")
        .update({"status": "cancelled", **_cancel_audit_fields("client")})
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .in_("status", ["pending", "accepted"])
        .execute()
    )
    if not rows(upd):
        return None
    if vendor_uid:
        dispatch_booking_notification(
            user_id=vendor_uid,
            booking_id=booking_id,
            kind="booking_cancelled_by_client",
            body=(
                "The client cancelled this booking. Their payment has been refunded in full."
                if refunded
                else "The client cancelled this booking."
            ),
        )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
    return {"id": booking_id, "status": "cancelled"}


def update_booking_request_status_for_client(
    client_user_id: str,
    booking_id: str,
    *,
    new_status: str,
    event_postcode: str | None = None,
    event_address: str | None = None,
) -> dict[str, Any] | None:
    """Client accepts or declines a pending vendor quote, or confirms an updated price."""
    if new_status not in ("accepted", "declined"):
        raise ValueError("Status must be accepted or declined.")
    if get_settings().local_auth_mode:
        return None

    db = get_client()
    res = (
        db.table("booking_requests")
        .select("id,status,vendor_user_id,initiator,vendor_adjustments")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row0 = one_row(res)
    if row0 is None:
        return None
    initiator = _row_initiator(row0)
    current = str(row0.get("status", ""))
    if current != "pending":
        raise ValueError("Only pending bookings can be accepted or declined.")
    vendor_uid = str(row0.get("vendor_user_id") or "")

    is_vendor_quote = initiator == "vendor"
    is_updated_price = initiator == "client" and client_price_confirmation_required(row0)
    if not is_vendor_quote and not is_updated_price:
        raise ValueError(
            "This action applies to vendor quotes or when the vendor sent an updated price.",
        )

    if new_status == "declined":
        upd = (
            db.table("booking_requests")
            .update({"status": "declined"})
            .eq("id", booking_id)
            .eq("client_user_id", client_user_id)
            .eq("status", "pending")
            .execute()
        )
        if not rows(upd):
            return None
        if vendor_uid:
            if is_vendor_quote:
                dispatch_booking_notification(
                    user_id=vendor_uid,
                    booking_id=booking_id,
                    kind="vendor_quote_declined",
                    body="The client declined your quote.",
                )
            else:
                dispatch_booking_notification(
                    user_id=vendor_uid,
                    booking_id=booking_id,
                    kind="client_declined_updated_price",
                    body="The client declined the updated price.",
                )
        _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
        return {"id": booking_id, "status": "declined"}

    pc = normalize_event_postcode_accept(event_postcode) if is_vendor_quote else None
    addr = (event_address.strip() if event_address else None) if is_vendor_quote else None

    update_payload: dict[str, Any] = {"status": "accepted"}
    if is_vendor_quote:
        update_payload["event_postcode"] = pc
        update_payload["event_address"] = addr

    upd = (
        db.table("booking_requests")
        .update(update_payload)
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .eq("status", "pending")
        .execute()
    )
    if not rows(upd):
        return None
    if vendor_uid:
        if is_vendor_quote:
            _notify_vendor_quote_accepted(vendor_uid, booking_id)
        else:
            _notify_client_confirmed_updated_price(vendor_uid, booking_id)
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
    return {"id": booking_id, "status": "accepted"}


def _notify_client_confirmed_updated_price(vendor_uid: str, booking_id: str) -> None:
    full = get_booking_request_for_vendor(vendor_uid, booking_id)
    if not full:
        return
    pricing = full.get("pricing") if isinstance(full.get("pricing"), dict) else {}
    ttl = str(pricing.get("client_total_label") or full.get("total_label") or "")
    dispatch_booking_notification(
        user_id=vendor_uid,
        booking_id=booking_id,
        kind="client_confirmed_updated_price",
        body=f"The client accepted the updated price. Total due: {ttl}. Waiting for payment.",
    )


def _notify_vendor_quote_accepted(vendor_uid: str, booking_id: str) -> None:
    full = get_booking_request_for_vendor(vendor_uid, booking_id)
    if not full:
        return
    pricing = full.get("pricing") if isinstance(full.get("pricing"), dict) else {}
    ttl = str(pricing.get("client_total_label") or full.get("total_label") or "")
    adj = full.get("vendor_adjustments")
    adj_list = adj if isinstance(adj, list) else []
    body = _client_booking_pricing_explanation_body(
        lead_sentence="The client accepted your quote.",
        total_label=ttl,
        adjustments=adj_list,
    )
    dispatch_booking_notification(
        user_id=vendor_uid,
        booking_id=booking_id,
        kind="vendor_quote_accepted",
        body=body,
    )
