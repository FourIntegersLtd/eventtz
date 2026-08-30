"""Booking creation: client requests and vendor quotes."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import first_row_from_query_result
from app.core.db import get_db
from app.features.bookings import messages as booking_messages
from app.features.bookings.booking_guard_checks import assert_target_user_is_client
from app.features.bookings.calendar import (
    _enforce_max_bookings_per_day,
    _enforce_vendor_calendar,
    _vendor_is_approved_for_explore,
    _vendor_is_approved_for_operating_bookings,
    rethrow_booking_capacity_db_error,
)
from app.features.bookings.line_item_validation import validate_quote_line_items
from app.features.bookings.notifications import _notify_booking_changed
from app.core.constants import BOOKING_SERVICE_FEE_PERCENT
from app.features.bookings.pricing import build_pricing_breakdown, persisted_booking_total_label
from app.features.vendor_referrals.booking_discount import pricing_snapshot_fields
from app.features.vendor_referrals.validate import resolve_referral_pricing_inputs
from app.features.chat.service import (
    assert_conversation_matches_pair,
    get_or_create_conversation,
    insert_message,
    send_quote_message,
)
from app.features.realtime.sse import notify_user
from app.features.email.dispatch import dispatch_booking_notification
from app.features.client_events.events import resolve_event_for_booking, touch_client_event_updated_at
from app.features.vendors.list_pricing import (
    compute_automatic_discount_lines,
    resolve_line_items,
)
from app.features.vendors.moderation import get_bookable_vendor_profile_form_data
from app.features.vendors.qa_visibility import explore_viewer_for_client_user_id
from app.features.auth.accounts import assert_user_not_suspended

logger = get_logger(__name__)


def _conversation_has_client_notes(
    *,
    conversation_id: str,
    client_user_id: str,
    notes: str,
) -> bool:
    """True if this DM already contains the booking notes as a client message."""
    text = notes.strip()
    if not text:
        return False
    try:
        res = (
            get_db()
            .table("messages")
            .select("id,body,sender_user_id,metadata")
            .eq("conversation_id", conversation_id)
            .eq("sender_user_id", client_user_id)
            .order("created_at", desc=False)
            .limit(40)
            .execute()
        )
    except Exception:
        logger.exception(
            "ensure booking notes: list messages failed conv=%s",
            conversation_id,
        )
        return False
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        meta = row.get("metadata")
        if isinstance(meta, dict) and meta.get("source") == "booking_notes":
            return True
        if str(row.get("body") or "").strip() == text:
            return True
    return False


def ensure_client_booking_notes_in_chat(
    *,
    booking_id: str,
    client_user_id: str,
    vendor_user_id: str,
    notes: str | None,
    conversation_id: str | None = None,
) -> str | None:
    """
    Put the client's booking notes into the chat thread as the first message,
    and link the booking to that thread.

    Safe to call more than once (e.g. when creating or opening the booking).
    Returns the conversation id, or None if none was set up.
    """
    text = (notes or "").strip()
    existing_cid = (conversation_id or "").strip() or None
    if not text or not booking_id:
        return existing_cid
    try:
        cid = existing_cid
        if not cid:
            conv = get_or_create_conversation(
                client_user_id=client_user_id,
                vendor_user_id=vendor_user_id,
                require_bookable_vendor=False,
            )
            cid = str(conv.get("id") or "").strip() or None
        if not cid:
            return None

        if not _conversation_has_client_notes(
            conversation_id=cid,
            client_user_id=client_user_id,
            notes=text,
        ):
            insert_message(
                conversation_id=cid,
                sender_user_id=client_user_id,
                body=text,
                metadata={"source": "booking_notes", "booking_id": booking_id},
            )
            notify_user(client_user_id, "chat_unread_changed")
            notify_user(vendor_user_id, "chat_unread_changed")

        if cid != existing_cid:
            try:
                get_db().table("booking_requests").update({"conversation_id": cid}).eq(
                    "id",
                    booking_id,
                ).execute()
            except Exception:
                logger.exception(
                    "ensure booking notes: link conversation_id failed booking=%s",
                    booking_id,
                )
        return cid
    except Exception:
        logger.exception(
            "ensure booking notes: failed booking=%s",
            booking_id,
        )
        return existing_cid


def _post_client_booking_notes_to_chat(
    *,
    booking_id: str,
    client_user_id: str,
    vendor_user_id: str,
    notes: str | None,
) -> str | None:
    """Called when creating a booking - see ensure_client_booking_notes_in_chat."""
    return ensure_client_booking_notes_in_chat(
        booking_id=booking_id,
        client_user_id=client_user_id,
        vendor_user_id=vendor_user_id,
        notes=notes,
        conversation_id=None,
    )


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
    client_search_context: dict[str, Any] | None = None,
    event_id: str | None = None,
    quantities: dict[str, int] | None = None,
    vendor_referral_code: str | None = None,
) -> dict[str, Any]:
    if client_user_id == vendor_user_id:
        raise ValueError(booking_messages.CANNOT_BOOK_OWN_VENDOR)

    viewer = explore_viewer_for_client_user_id(client_user_id)

    if not _vendor_is_approved_for_explore(vendor_user_id, viewer=viewer):
        raise ValueError(
            booking_messages.VENDOR_NOT_AVAILABLE_FULL,
        )

    assert_user_not_suspended(client_user_id)
    assert_user_not_suspended(vendor_user_id)

    _enforce_vendor_calendar(vendor_user_id, event_date, event_end_date, viewer=viewer)

    payload = get_bookable_vendor_profile_form_data(vendor_user_id, viewer=viewer)
    if payload is None:
        raise ValueError(
            booking_messages.VENDOR_NOT_AVAILABLE_FULL,
        )

    _enforce_max_bookings_per_day(vendor_user_id, payload, event_date, event_end_date)

    line_items = resolve_line_items(payload, selected_option_ids, quantities)
    line_items = line_items + compute_automatic_discount_lines(payload, line_items, event_date)

    li_sum = sum(float(li.get("unit_price_gbp") or 0) for li in line_items if isinstance(li, dict))
    vendor_portion_est = round(li_sum, 2)
    normalized_referral, referral_discount, tier_min = resolve_referral_pricing_inputs(
        vendor_user_id,
        vendor_referral_code,
        vendor_portion_est,
    )
    pb = build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=float(BOOKING_SERVICE_FEE_PERCENT),
        referral_fee_discount_gbp=referral_discount,
        referral_tier_min_spend_gbp=tier_min,
    )
    if float(pb.get("vendor_portion_gbp") or 0) <= 0 and not pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.BOOKING_NO_VALID_PRICE)
    client_total = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
    search_ctx = (
        client_search_context
        if isinstance(client_search_context, dict) and client_search_context
        else None
    )
    resolved_event_id, event_fields = resolve_event_for_booking(
        client_user_id,
        event_id=event_id,
        event_name=event_name,
        event_date=event_date,
        event_end_date=event_end_date,
        event_address=event_address,
        event_postcode=event_postcode,
    )
    row_out: dict[str, Any] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        **event_fields,
        "notes": (notes.strip() if notes else None),
        "status": "pending",
        "selected_option_ids": selected_option_ids,
        "line_items": line_items,
        **pricing_snapshot_fields(pb),
        "initial_client_total_label": client_total,
        "vendor_adjustments": [],
        "initiator": "client",
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
        "vendor_referral_code": normalized_referral,
    }
    if search_ctx is not None:
        row_out["client_search_context"] = search_ctx

    try:
        res = get_db().table("booking_requests").insert(row_out).execute()
    except Exception as e:
        rethrow_booking_capacity_db_error(e)
    created = first_row_from_query_result(res)
    if created is None:
        raise RuntimeError("Failed to create booking request")
    bid = str(created.get("id", ""))
    notes_val = row_out.get("notes") if isinstance(row_out.get("notes"), str) else None
    conversation_id = _post_client_booking_notes_to_chat(
        booking_id=bid,
        client_user_id=client_user_id,
        vendor_user_id=vendor_user_id,
        notes=notes_val,
    )
    if vendor_user_id:
        dispatch_booking_notification(
            user_id=vendor_user_id,
            booking_id=bid,
            kind="booking_request_received",
        )
        from app.features.bookings.booking_funnel_timestamps import mark_vendor_notified

        mark_vendor_notified(bid)
        try:
            from app.features.analytics.events import record_marketplace_event

            batch_size = None
            batch_index = None
            if isinstance(search_ctx, dict):
                try:
                    if search_ctx.get("batchSize") is not None:
                        batch_size = int(search_ctx["batchSize"])
                    if search_ctx.get("batchIndex") is not None:
                        batch_index = int(search_ctx["batchIndex"])
                except (TypeError, ValueError):
                    batch_size = None
                    batch_index = None
            record_marketplace_event(
                "enquiry_created",
                actor_user_id=client_user_id,
                vendor_user_id=vendor_user_id,
                booking_request_id=bid,
                payload={
                    "has_search_context": bool(search_ctx),
                    "batch_size": batch_size,
                },
            )
            if batch_size is not None and batch_size > 1 and (batch_index or 0) == 0:
                record_marketplace_event(
                    "enquiry_multi_created",
                    actor_user_id=client_user_id,
                    vendor_user_id=vendor_user_id,
                    booking_request_id=bid,
                    payload={"vendor_count": batch_size},
                )
            record_marketplace_event(
                "vendor_notified",
                actor_user_id=client_user_id,
                vendor_user_id=vendor_user_id,
                booking_request_id=bid,
            )
        except Exception:
            pass
    # Client confirmation (in-app + email).
    dispatch_booking_notification(
        user_id=client_user_id,
        booking_id=bid,
        kind="booking_request_sent",
        mode="insert_if_absent",
        portal="client",
    )
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_user_id)
    touch_client_event_updated_at(resolved_event_id)
    return {
        "id": bid,
        "status": str(created.get("status", "pending")),
        "created_at": created.get("created_at"),
        "conversation_id": conversation_id,
        "event_id": resolved_event_id,
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
        raise ValueError(booking_messages.CANNOT_QUOTE_SELF)

    if not _vendor_is_approved_for_operating_bookings(vendor_user_id):
        raise ValueError(
            booking_messages.VENDOR_PROFILE_NOT_AVAILABLE,
        )

    assert_user_not_suspended(vendor_user_id)
    assert_target_user_is_client(client_user_id)

    if not line_items:
        raise ValueError(booking_messages.ADD_PRICED_LINE_ITEM)

    if conversation_id and conversation_id.strip():
        assert_conversation_matches_pair(
            conversation_id=conversation_id.strip(),
            client_user_id=client_user_id,
            vendor_user_id=vendor_user_id,
        )

    operator_viewer = explore_viewer_for_client_user_id(vendor_user_id)
    _enforce_vendor_calendar(
        vendor_user_id,
        event_date,
        event_end_date,
        viewer=operator_viewer,
        operator=True,
    )

    vpayload = get_bookable_vendor_profile_form_data(
        vendor_user_id,
        viewer=operator_viewer,
        operator=True,
    ) or {}
    _enforce_max_bookings_per_day(vendor_user_id, vpayload, event_date, event_end_date)

    line_items = validate_quote_line_items(line_items)

    pb = build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=float(BOOKING_SERVICE_FEE_PERCENT),
    )
    if pb.get("has_pricing_tbc"):
        raise ValueError(booking_messages.QUOTE_LINE_NEEDS_PRICE)
    if float(pb.get("vendor_portion_gbp") or 0) <= 0:
        raise ValueError(booking_messages.QUOTE_TOTAL_GT_ZERO)

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
        **pricing_snapshot_fields(pb),
        "initial_client_total_label": str(pb.get("client_total_label") or persisted_booking_total_label(pb)),
        "vendor_adjustments": [],
        "initiator": "vendor",
        "event_postcode": None,
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
    }
    if conversation_id and conversation_id.strip():
        row_out["conversation_id"] = conversation_id.strip()

    try:
        res = get_db().table("booking_requests").insert(row_out).execute()
    except Exception as e:
        rethrow_booking_capacity_db_error(e)
    created = first_row_from_query_result(res)
    if created is None:
        raise RuntimeError("Failed to create vendor quote")
    bid = str(created.get("id", ""))
    ttl = str(pb.get("client_total_label") or persisted_booking_total_label(pb))
    if client_user_id:
        body = (
            f"You have received a new quote from a vendor.\n\n"
            f"Total: {ttl}. Please review the details and accept or decline when you are ready."
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
