"""Vendor booking status transitions: accept, decline, cancel, withdraw quote."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import first_row_from_query_result, rows_from_query_result
from app.core.db import get_db
from app.features.bookings import messages as booking_messages
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.pricing_confirmation import client_price_confirmation_required
from app.features.bookings.queries import (
    _row_initiator,
    get_booking_request_for_client,
)
from app.features.bookings.booking_funnel_timestamps import (
    apply_accept_update,
    apply_decline_update,
)
from app.features.bookings.status_shared import (
    assert_booking_may_be_cancelled,
    cancel_audit_fields,
    expire_pending_checkout_session,
    refund_paid_booking_before_cancel,
    vendor_connect_can_receive_payouts,
)
from app.features.email.dispatch import dispatch_booking_notification

def update_booking_request_status_for_vendor(
    vendor_user_id: str,
    booking_id: str,
    *,
    new_status: str,
) -> dict[str, Any] | None:
    """Vendor transitions: pending→accepted/declined; declined→accepted; accepted→cancelled."""
    if new_status not in ("accepted", "declined", "cancelled"):
        raise ValueError(booking_messages.STATUS_VENDOR_MUST_BE)
    client = get_db()
    res = (
        client.table("booking_requests")
        .select("id,status,client_user_id,initiator,paid_at,payment_status,vendor_adjustments,stripe_checkout_session_id")
        .eq("id", booking_id)
        .eq("vendor_user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    row0 = first_row_from_query_result(res)
    if row0 is None:
        return None
    current = str(row0.get("status", ""))
    client_uid = str(row0.get("client_user_id") or "")
    payment_status = str(row0.get("payment_status") or "")
    initiator = _row_initiator(row0)

    if new_status == "cancelled":
        if current == "accepted":
            assert_booking_may_be_cancelled(booking_id, status=current, payment_status=payment_status)
            expire_pending_checkout_session(payment_status, row0.get("stripe_checkout_session_id"))
            refunded = refund_paid_booking_before_cancel(
                booking_id,
                payment_status,
                cancelled_by="vendor",
            )
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled", **cancel_audit_fields("vendor")})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "accepted")
                .execute()
            )
            if not rows_from_query_result(upd):
                return None
            if client_uid:
                if refunded:
                    dispatch_booking_notification(
                        user_id=client_uid,
                        booking_id=booking_id,
                        kind="booking_cancelled_by_vendor",
                        body=(
                            "The vendor has cancelled this booking. Your payment has been refunded in full.\n\n"
                            "It should reach your card within 5-10 working days, depending on your bank."
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
                .update({"status": "cancelled", **cancel_audit_fields("vendor")})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows_from_query_result(upd):
                return None
            if client_uid:
                dispatch_booking_notification(
                    user_id=client_uid,
                    booking_id=booking_id,
                    kind="vendor_quote_withdrawn",
                    body=(
                        "The vendor withdrew their quote.\n\n"
                        "This booking is no longer active. You can message them or explore other vendors."
                    ),
                )
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "cancelled"}
        raise ValueError(
            booking_messages.CANCEL_ONLY_ACCEPTED_OR_QUOTE,
        )

    if new_status == "accepted":
        if initiator == "vendor":
            raise ValueError(booking_messages.CLIENT_MUST_ACCEPT_QUOTE)
        if not vendor_connect_can_receive_payouts(vendor_user_id):
            raise ValueError(booking_messages.COMPLETE_PAYOUT_SETUP)
        if current == "pending":
            if client_price_confirmation_required(row0):
                raise ValueError(
                    booking_messages.CLIENT_MUST_CONFIRM_PRICE,
                )
            upd = (
                client.table("booking_requests")
                .update(apply_accept_update(booking_id, created_at=row0.get("created_at")))
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows_from_query_result(upd):
                return None
            if client_uid:
                _notify_client_booking_accepted(client_uid, booking_id)
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            try:
                from app.features.analytics.events import record_marketplace_event

                record_marketplace_event(
                    "vendor_accepted_booking",
                    actor_user_id=vendor_user_id,
                    vendor_user_id=vendor_user_id,
                    booking_request_id=booking_id,
                )
            except Exception:
                pass
            return {"id": booking_id, "status": "accepted"}
        if current == "declined":
            upd = (
                client.table("booking_requests")
                .update(apply_accept_update(booking_id, created_at=row0.get("created_at")))
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "declined")
                .execute()
            )
            if not rows_from_query_result(upd):
                return None
            if client_uid:
                _notify_client_booking_accepted(client_uid, booking_id)
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "accepted"}
        raise ValueError(
            booking_messages.ACCEPT_ONLY_PENDING_OR_REJECTED,
        )

    if new_status == "declined":
        if initiator == "vendor":
            raise ValueError(booking_messages.WITHDRAW_QUOTE_USE_CANCEL)
        if current != "pending":
            raise ValueError(booking_messages.ONLY_PENDING_CAN_DECLINE)
        upd = (
            client.table("booking_requests")
            .update(apply_decline_update(booking_id, created_at=row0.get("created_at")))
            .eq("id", booking_id)
            .eq("vendor_user_id", vendor_user_id)
            .eq("status", "pending")
            .execute()
        )
        if not rows_from_query_result(upd):
            return None
        if client_uid:
            dispatch_booking_notification(
                user_id=client_uid,
                booking_id=booking_id,
                kind="booking_declined_by_vendor",
                    body=(
                        "Unfortunately the vendor is unable to take this booking.\n\n"
                        "We are sorry that could not work out. You are welcome to browse other vendors "
                        "on Eventtz and send a new request whenever you are ready."
                    ),
            )
        _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
        try:
            from app.features.analytics.events import record_marketplace_event

            record_marketplace_event(
                "vendor_declined_booking",
                actor_user_id=vendor_user_id,
                vendor_user_id=vendor_user_id,
                booking_request_id=booking_id,
            )
        except Exception:
            pass
        return {"id": booking_id, "status": "declined"}

    raise ValueError(booking_messages.UNSUPPORTED_STATUS_TRANSITION)


def _notify_client_booking_accepted(client_uid: str, booking_id: str) -> None:
    full = get_booking_request_for_client(client_uid, booking_id)
    if not full:
        return
    pricing = full.get("pricing") if isinstance(full.get("pricing"), dict) else {}
    ttl = str(pricing.get("client_total_label") or full.get("total_label") or "")
    adj = full.get("vendor_adjustments")
    adj_list = adj if isinstance(adj, list) else []
    body = _client_booking_pricing_explanation_body(
        lead_sentence="Good news - your booking was accepted.",
        total_label=ttl,
        adjustments=adj_list,
    )
    dispatch_booking_notification(
        user_id=client_uid,
        booking_id=booking_id,
        kind="booking_accepted",
        body=body,
    )


