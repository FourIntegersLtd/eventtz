"""Booking status changes for clients and vendors (accept, decline, cancel)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import first_row_from_query_result, rows_from_query_result
from app.core.db import get_db
from app.features.bookings import messages as booking_messages
from app.features.bookings.booking_guard_checks import normalize_event_postcode_accept
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.pricing_confirmation import client_price_confirmation_required
from app.features.bookings.pricing import build_pricing_breakdown, persisted_booking_total_label
from app.features.bookings.queries import (
    _row_initiator,
    get_booking_request_for_client,
    get_booking_request_for_vendor,
)
from app.features.bookings.booking_funnel_timestamps import (
    apply_accept_update,
    apply_decline_update,
    mark_customer_cancelled_failure,
)
from app.features.bookings.booking_payment_helpers import _get_vendor_stripe_fields
from app.features.email.dispatch import dispatch_booking_notification
from app.features.vendors.visibility import payout_gate_waived


def _guard_cancel_money_state(booking_id: str, *, status: str, payment_status: str) -> None:
    """Shared checks before cancel: not after payout, not while a problem report is open."""
    if status == "completed":
        raise ValueError(
            booking_messages.CANCEL_COMPLETE_INSTEAD,
        )
    if payment_status == "payout_released":
        raise ValueError(
            booking_messages.CANCEL_AFTER_PAYOUT,
        )
    if payment_status == "partially_refunded":
        raise ValueError(
            booking_messages.CANCEL_PARTIAL_REFUND,
        )
    if payment_status == "refunded" and status != "accepted":
        raise ValueError(booking_messages.BOOKING_ALREADY_REFUNDED)
    # Import here to avoid a circular import at module load.
    from app.features.bookings.disputes import has_active_dispute_for_booking

    if has_active_dispute_for_booking(booking_id):
        raise ValueError(
            booking_messages.CANCEL_OPEN_DISPUTE,
        )


def _refund_paid_booking_for_cancel(booking_id: str, payment_status: str, *, cancelled_by: str) -> bool:
    """Full refund before cancelling a paid booking. Returns True if a refund was issued."""
    if payment_status != "paid":
        return False
    # Import here to avoid a circular import at module load.
    from app.features.bookings.payments import refund_booking_on_cancel

    refund_booking_on_cancel(booking_id, cancelled_by=cancelled_by)
    return True


def _cancel_audit_fields(cancelled_by: str) -> dict[str, str]:
    return {
        "cancelled_by": cancelled_by,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }


def _vendor_payouts_ready(vendor_user_id: str) -> bool:
    """True when Stripe Connect can charge and pay out (required before accept).

    Why gate here: Accept is when Eventtz commits to Collect + Transfer, so customers
    never wait on Connect mid-pay. An admin listing waiver lifts the gate for a vendor
    vetted another way - the client's money is still held by Eventtz until completion.
    """
    row = _get_vendor_stripe_fields(vendor_user_id)
    if row is None:
        return False
    if payout_gate_waived(row):
        return True
    return bool(
        row.get("stripe_account_id")
        and row.get("stripe_charges_enabled")
        and row.get("stripe_payouts_enabled")
    )


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
        .select("id,status,client_user_id,initiator,paid_at,payment_status,vendor_adjustments")
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
                .update({"status": "cancelled", **_cancel_audit_fields("vendor")})
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
        if not _vendor_payouts_ready(vendor_user_id):
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


def cancel_booking_request_for_client(
    client_user_id: str,
    booking_id: str,
) -> dict[str, Any] | None:
    """Client cancels a pending or accepted booking."""
    db = get_db()
    res = (
        db.table("booking_requests")
        .select("id,status,vendor_user_id,payment_status")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row0 = first_row_from_query_result(res)
    if row0 is None:
        return None
    current = str(row0.get("status", ""))
    vendor_uid = str(row0.get("vendor_user_id") or "")
    payment_status = str(row0.get("payment_status") or "")
    if current == "completed":
        _guard_cancel_money_state(booking_id, status=current, payment_status=payment_status)
    if current not in ("pending", "accepted"):
        raise ValueError(booking_messages.ONLY_PENDING_OR_ACCEPTED_CANCEL)

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
    if not rows_from_query_result(upd):
        return None
    if vendor_uid:
        dispatch_booking_notification(
            user_id=vendor_uid,
            booking_id=booking_id,
            kind="booking_cancelled_by_client",
            body=(
                "The client has cancelled this booking. Their payment has been refunded in full.\n\n"
                "No further action is needed on your side."
                if refunded
                else (
                    "The client has cancelled this booking.\n\n"
                    "The booking is now closed. You can still message them on Eventtz if you need to."
                )
            ),
        )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
    mark_customer_cancelled_failure(booking_id)
    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "booking_cancelled",
            actor_user_id=client_user_id,
            vendor_user_id=vendor_uid or None,
            booking_request_id=booking_id,
        )
    except Exception:
        pass
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
        raise ValueError(booking_messages.STATUS_CLIENT_MUST_BE)
    db = get_db()
    res = (
        db.table("booking_requests")
        .select("id,status,vendor_user_id,initiator,vendor_adjustments,line_items")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row0 = first_row_from_query_result(res)
    if row0 is None:
        return None
    initiator = _row_initiator(row0)
    current = str(row0.get("status", ""))
    if current != "pending":
        raise ValueError(booking_messages.ONLY_PENDING_ACCEPT_DECLINE)
    vendor_uid = str(row0.get("vendor_user_id") or "")

    is_vendor_quote = initiator == "vendor"
    is_updated_price = initiator == "client" and client_price_confirmation_required(row0)
    if not is_vendor_quote and not is_updated_price:
        raise ValueError(
            booking_messages.VENDOR_QUOTE_OR_UPDATED_PRICE,
        )

    if new_status == "declined":
        if is_updated_price:
            line_items = row0.get("line_items")
            if not isinstance(line_items, list):
                line_items = []
            pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
            revert_payload: dict[str, Any] = {
                "vendor_adjustments": [],
                "total_label": persisted_booking_total_label(pb),
            }
            upd = (
                db.table("booking_requests")
                .update(revert_payload)
                .eq("id", booking_id)
                .eq("client_user_id", client_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows_from_query_result(upd):
                return None
            if vendor_uid:
                dispatch_booking_notification(
                    user_id=vendor_uid,
                    booking_id=booking_id,
                    kind="client_declined_updated_price",
                    body=(
                        "The client declined the updated price.\n\n"
                        "The booking is still open at the original price. You can message them "
                        "or send a new price if needed."
                    ),
                )
            _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
            return {"id": booking_id, "status": "pending"}

        upd = (
            db.table("booking_requests")
            .update({"status": "declined"})
            .eq("id", booking_id)
            .eq("client_user_id", client_user_id)
            .eq("status", "pending")
            .execute()
        )
        if not rows_from_query_result(upd):
            return None
        if vendor_uid:
            dispatch_booking_notification(
                user_id=vendor_uid,
                booking_id=booking_id,
                kind="vendor_quote_declined",
                body=(
                    "The client declined your quote.\n\n"
                    "The booking has been closed. You can still message them on Eventtz."
                ),
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
    if not rows_from_query_result(upd):
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
        body=(
            f"The client accepted the updated price.\n\n"
            f"Total due: {ttl}. We will notify you when payment is received."
        ),
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
