"""Booking creation: client requests and vendor quotes."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import one_row
from app.core.db import get_db as get_client
from app.features.bookings._command_helpers import assert_target_user_is_client
from app.features.bookings.calendar import (
    _enforce_max_bookings_per_day,
    _enforce_vendor_calendar,
    _vendor_is_approved_for_explore,
    rethrow_booking_capacity_db_error,
)
from app.features.bookings.line_item_validation import validate_quote_line_items
from app.features.bookings.notifications import _notify_booking_changed
from app.features.bookings.pricing import build_pricing_breakdown, persisted_booking_total_label
from app.features.chat.service import assert_conversation_matches_pair, send_quote_message
from app.features.email.dispatch import dispatch_booking_notification
from app.features.vendors.moderation import get_approved_vendor_payload
from app.features.vendors.list_pricing import (
    compute_automatic_discount_lines,
    resolve_line_items,
)
from app.features.auth.accounts import assert_user_not_suspended

logger = get_logger(__name__)


def create_booking_request(
    *,
    client_user_id: str,
    vendor_user_id: str,
    event_name: str,
    event_date: date,
    event_end_date: date | None,
    event_postcode: str | None = None,
    event_address: str | None = None,
    notes: str | None,
    selected_option_ids: list[str],
) -> dict[str, Any]:
    if client_user_id == vendor_user_id:
        raise ValueError("Cannot book your own account as vendor.")

    if not _vendor_is_approved_for_explore(vendor_user_id):
        raise ValueError(
            "This vendor is not available for booking right now. "
            "They may be unlisted or not yet approved.",
        )

    assert_user_not_suspended(client_user_id)
    assert_user_not_suspended(vendor_user_id)

    if get_settings().local_auth_mode:
        logger.info(
            "create_booking_request local_auth_mode skip DB client=%s vendor=%s",
            client_user_id,
            vendor_user_id,
        )
        return {
            "id": "00000000-0000-4000-8000-000000000001",
            "status": "pending",
            "created_at": None,
        }

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date)

    payload = get_approved_vendor_payload(vendor_user_id)
    if payload is None:
        raise ValueError(
            "This vendor is not available for booking right now. "
            "They may be unlisted or not yet approved.",
        )

    _enforce_max_bookings_per_day(vendor_user_id, payload, event_date, event_end_date)

    line_items = resolve_line_items(payload, selected_option_ids)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
    if float(pb.get("vendor_portion_gbp") or 0) <= 0 and not pb.get("has_pricing_tbc"):
        raise ValueError("This booking has no valid price.")
    client_total = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
    row_out: dict[str, Any] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": event_name.strip(),
        "event_date": event_date.isoformat(),
        "event_end_date": event_end_date.isoformat() if event_end_date else None,
        "event_postcode": event_postcode.strip() if event_postcode else None,
        "event_address": (event_address.strip() if event_address else None),
        "notes": (notes.strip() if notes else None),
        "status": "pending",
        "selected_option_ids": selected_option_ids,
        "line_items": line_items,
        "total_label": persisted_booking_total_label(pb),
        "initial_client_total_label": client_total,
        "vendor_adjustments": [],
        "initiator": "client",
    }

    try:
        res = get_client().table("booking_requests").insert(row_out).execute()
    except Exception as e:
        rethrow_booking_capacity_db_error(e)
    created = one_row(res)
    if created is None:
        raise RuntimeError("Failed to create booking request")
    bid = str(created.get("id", ""))
    if vendor_user_id:
        dispatch_booking_notification(
            user_id=vendor_user_id,
            booking_id=bid,
            kind="booking_request_received",
        )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_user_id)
    return {
        "id": bid,
        "status": str(created.get("status", "pending")),
        "created_at": created.get("created_at"),
    }


def create_vendor_quote_booking_request(
    *,
    vendor_user_id: str,
    client_user_id: str,
    conversation_id: str | None,
    event_name: str,
    event_date: date,
    event_end_date: date | None,
    notes: str | None,
    line_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Vendor sends a custom quote; pending until the client accepts or declines."""
    if client_user_id == vendor_user_id:
        raise ValueError("Cannot send a quote to yourself.")

    if not _vendor_is_approved_for_explore(vendor_user_id):
        raise ValueError(
            "Your vendor profile is not available for bookings right now.",
        )

    assert_user_not_suspended(vendor_user_id)
    assert_target_user_is_client(client_user_id)

    if not line_items:
        raise ValueError("Add at least one priced line item.")

    if conversation_id and conversation_id.strip():
        assert_conversation_matches_pair(
            conversation_id=conversation_id.strip(),
            client_user_id=client_user_id,
            vendor_user_id=vendor_user_id,
        )

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date)

    vpayload = get_approved_vendor_payload(vendor_user_id) or {}
    _enforce_max_bookings_per_day(vendor_user_id, vpayload, event_date, event_end_date)

    line_items = validate_quote_line_items(line_items)

    pb = build_pricing_breakdown(line_items=line_items, vendor_adjustments=[])
    if pb.get("has_pricing_tbc"):
        raise ValueError("Each quote line needs a price.")
    if float(pb.get("vendor_portion_gbp") or 0) <= 0:
        raise ValueError("Quote total must be greater than zero.")

    if get_settings().local_auth_mode:
        logger.info(
            "create_vendor_quote_booking_request local_auth_mode skip DB vendor=%s client=%s",
            vendor_user_id,
            client_user_id,
        )
        return {
            "id": "00000000-0000-4000-8000-000000000002",
            "status": "pending",
            "created_at": None,
        }

    row_out: dict[str, Any] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": event_name.strip(),
        "event_date": event_date.isoformat(),
        "event_end_date": event_end_date.isoformat() if event_end_date else None,
        "notes": (notes.strip() if notes else None),
        "status": "pending",
        "selected_option_ids": [],
        "line_items": line_items,
        "total_label": persisted_booking_total_label(pb),
        "initial_client_total_label": str(pb.get("client_total_label") or persisted_booking_total_label(pb)),
        "vendor_adjustments": [],
        "initiator": "vendor",
        "event_postcode": None,
    }
    if conversation_id and conversation_id.strip():
        row_out["conversation_id"] = conversation_id.strip()

    try:
        res = get_client().table("booking_requests").insert(row_out).execute()
    except Exception as e:
        rethrow_booking_capacity_db_error(e)
    created = one_row(res)
    if created is None:
        raise RuntimeError("Failed to create vendor quote")
    bid = str(created.get("id", ""))
    ttl = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
    if client_user_id:
        body = (
            f"Total: {ttl}. Review the quote and accept or decline."
        )
        dispatch_booking_notification(
            user_id=client_user_id,
            booking_id=bid,
            kind="vendor_quote_received",
            body=body,
        )
    if conversation_id and conversation_id.strip():
        send_quote_message(
            conversation_id=conversation_id.strip(),
            sender_user_id=vendor_user_id,
            recipient_user_id=client_user_id,
            booking_request_id=bid,
            event_name=event_name.strip(),
            total_label=ttl,
        )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_user_id)
    return {
        "id": bid,
        "status": str(created.get("status", "pending")),
        "created_at": created.get("created_at"),
    }
