"""Booking status transitions for client and vendor."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import one_row, rows
from app.core.db import get_db as get_client
from app.features.bookings._command_helpers import normalize_event_postcode_accept
from app.features.bookings.notifications import (
    _client_booking_pricing_explanation_body,
    _notify_booking_changed,
)
from app.features.bookings.queries import (
    _row_initiator,
    get_booking_request_for_client,
    get_booking_request_for_vendor,
)
from app.features.notifications.service import (
    insert_booking_notification_if_absent,
    upsert_booking_notification,
)


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
        .select("id,status,client_user_id,initiator,paid_at")
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
    initiator = _row_initiator(row0)

    if new_status == "cancelled":
        if current == "accepted":
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled"})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "accepted")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                insert_booking_notification_if_absent(
                    user_id=client_uid,
                    booking_id=booking_id,
                    kind="booking_cancelled_by_vendor",
                )
            _notify_booking_changed(client_user_id=client_uid, vendor_user_id=vendor_user_id)
            return {"id": booking_id, "status": "cancelled"}
        if current == "pending" and initiator == "vendor":
            upd = (
                client.table("booking_requests")
                .update({"status": "cancelled"})
                .eq("id", booking_id)
                .eq("vendor_user_id", vendor_user_id)
                .eq("status", "pending")
                .execute()
            )
            if not rows(upd):
                return None
            if client_uid:
                upsert_booking_notification(
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
            upsert_booking_notification(
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
    upsert_booking_notification(
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
        .select("id,status,vendor_user_id")
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
    if current not in ("pending", "accepted"):
        raise ValueError("Only pending or accepted bookings can be cancelled.")

    upd = (
        db.table("booking_requests")
        .update({"status": "cancelled"})
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .in_("status", ["pending", "accepted"])
        .execute()
    )
    if not rows(upd):
        return None
    if vendor_uid:
        upsert_booking_notification(
            user_id=vendor_uid,
            booking_id=booking_id,
            kind="booking_cancelled_by_client",
            body="The client cancelled this booking.",
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
    """Client accepts or declines a pending vendor quote (initiator vendor)."""
    if new_status not in ("accepted", "declined"):
        raise ValueError("Status must be accepted or declined.")
    if get_settings().local_auth_mode:
        return None

    db = get_client()
    res = (
        db.table("booking_requests")
        .select("id,status,vendor_user_id,initiator")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row0 = one_row(res)
    if row0 is None:
        return None
    if _row_initiator(row0) != "vendor":
        raise ValueError("This action applies only to vendor quotes.")
    current = str(row0.get("status", ""))
    if current != "pending":
        raise ValueError("Only pending vendor quotes can be accepted or declined.")
    vendor_uid = str(row0.get("vendor_user_id") or "")

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
            upsert_booking_notification(
                user_id=vendor_uid,
                booking_id=booking_id,
                kind="vendor_quote_declined",
                body="The client declined your quote.",
            )
        _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
        return {"id": booking_id, "status": "declined"}

    pc = normalize_event_postcode_accept(event_postcode)
    if not pc:
        raise ValueError("Event postcode is required to accept this quote.")

    addr = (event_address.strip() if event_address else None) or None

    upd = (
        db.table("booking_requests")
        .update({"status": "accepted", "event_postcode": pc, "event_address": addr})
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .eq("status", "pending")
        .execute()
    )
    if not rows(upd):
        return None
    if vendor_uid:
        _notify_vendor_quote_accepted(vendor_uid, booking_id)
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_uid)
    return {"id": booking_id, "status": "accepted"}


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
    upsert_booking_notification(
        user_id=vendor_uid,
        booking_id=booking_id,
        kind="vendor_quote_accepted",
        body=body,
    )
