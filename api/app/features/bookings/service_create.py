"""Opening a booking: a client's request for a vendor's packages, or a vendor's custom quote.

Both start `pending`. The price comes from the vendor's stored price list (a
request) or the vendor's own lines (a quote), never from the client. Both check
the vendor's calendar and daily capacity; the database trigger (migration 033)
has the last word when two requests race for the last slot.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.db import as_uuid
from app.core.ports import Mailer
from app.features.bookings import domain, repository, service_pricing
from app.features.bookings.errors import (
    CannotBookOwnVendor,
    CannotQuoteSelf,
    EventDatesUnavailable,
    InvalidClientId,
    InvalidConversationId,
    InvalidVendorId,
    LineItemsInvalid,
    NoValidPrice,
    PartySuspended,
    QuoteClientNotFound,
    QuoteClientSuspended,
    QuoteLineNeedsPrice,
    QuotesClientOnly,
    QuoteTotalNotPositive,
    VendorNotBookable,
    VendorProfileNotBookable,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import (
    BookingRequestCreated,
    CreateBookingRequestBody,
    CreateVendorQuoteBody,
)
from app.features.bookings.service_common import announce_change, link_notes_thread
from app.features.identity import service_accounts as accounts
from app.features.marketplace import service_events as events
from app.features.marketplace import service_explore
from app.features.messaging import service_bookings as messaging
from app.features.notifications import service_booking as notices
from app.features.planner import service_bookings as planner
from app.features.pricing import service as pricing
from app.features.referrals import service_client_codes as referral_codes
from app.features.vendors import service_catalogue


async def _require_not_suspended(session: AsyncSession, user_id: str) -> None:
    """Refuse when the account exists and is suspended."""
    account = await accounts.lookup_account(session, user_id)
    if account is not None and account.account_suspended:
        raise PartySuspended()


async def _check_calendar_and_capacity(
    session: AsyncSession,
    vendor_user_id: str,
    payload: dict[str, Any],
    event_date: date,
    event_end_date: date | None,
) -> None:
    """Refuse days the vendor does not work, and days already at their `maxBookingsPerDay`."""
    days = domain.event_days(event_date, event_end_date)
    if not service_explore.vendor_works_on(payload, days):
        raise EventDatesUnavailable()
    raw_cap = payload.get("maxBookingsPerDay")
    cap = domain.daily_cap(
        service_catalogue.parse_money_gbp(str(raw_cap).strip() if raw_cap is not None else "1")
    )
    domain.check_daily_capacity(days, await repository.open_booking_dates(session, vendor_user_id), cap)


def _opening_columns(breakdown: pricing.PricingBreakdown) -> dict[str, Any]:
    """The price columns every new booking stores."""
    return {
        **service_pricing.snapshot_columns(breakdown),
        "initial_client_total_label": service_pricing.client_total_label(breakdown),
        "vendor_adjustments": [],
        "service_fee_percent": float(pricing.BOOKING_SERVICE_FEE_PERCENT),
        "status": "pending",
    }


def _search_batch(search_context: dict[str, Any] | None) -> tuple[int | None, int | None]:
    """The size of the multi-vendor enquiry this request is part of, and its place in it."""
    if not search_context:
        return None, None
    try:
        raw_size, raw_index = search_context.get("batchSize"), search_context.get("batchIndex")
        return (
            int(raw_size) if raw_size is not None else None,
            int(raw_index) if raw_index is not None else None,
        )
    except (TypeError, ValueError):
        return None, None


async def _record_enquiry_events(
    session: AsyncSession, booking: BookingRow, search_context: dict[str, Any] | None
) -> None:
    """The funnel events for a new client enquiry."""
    batch_size, batch_index = _search_batch(search_context)

    async def record(event_name: str, payload: dict[str, Any] | None = None) -> None:
        """One funnel event about this booking, by the client."""
        await events.record_marketplace_event(
            session,
            event_name,
            actor_user_id=booking.client_user_id,
            vendor_user_id=booking.vendor_user_id,
            booking_request_id=booking.id,
            payload=payload,
        )

    await record("enquiry_created", {"has_search_context": bool(search_context), "batch_size": batch_size})
    if batch_size is not None and batch_size > 1 and (batch_index or 0) == 0:
        await record("enquiry_multi_created", {"vendor_count": batch_size})
    await record("vendor_notified")


async def create_request(
    session: AsyncSession, mailer: Mailer, client: Principal, body: CreateBookingRequestBody
) -> BookingRequestCreated:
    """A client asks a vendor for some of their packages; the vendor is told and the notes go to chat."""
    vendor_id = body.vendor_user_id.strip()
    if as_uuid(vendor_id) is None:
        raise InvalidVendorId()
    if vendor_id == client.id:
        raise CannotBookOwnVendor()
    payload = await service_explore.bookable_vendor_payload(session, vendor_id, viewer=client)
    if payload is None:
        raise VendorNotBookable()
    await _require_not_suspended(session, client.id)
    await _require_not_suspended(session, vendor_id)
    await _check_calendar_and_capacity(session, vendor_id, payload, body.event_date, body.event_end_date)

    try:
        line_items = service_catalogue.resolve_line_items(payload, body.selected_option_ids, body.quantities)
    except ValueError as error:
        raise LineItemsInvalid(str(error)) from error
    line_items = line_items + service_catalogue.compute_automatic_discount_lines(
        payload, line_items, body.event_date
    )

    code = await referral_codes.code_for_booking(session, vendor_id, body.vendor_referral_code)
    discount, tier_min = (0.0, None)
    if code:
        packages_total = round(sum(float(line.get("unit_price_gbp") or 0) for line in line_items), 2)
        discount, tier_min = referral_codes.spend_discount(packages_total)
    breakdown = pricing.build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=float(pricing.BOOKING_SERVICE_FEE_PERCENT),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )
    if breakdown.vendor_portion_gbp <= 0 and not breakdown.has_pricing_tbc:
        raise NoValidPrice()

    event = await planner.resolve_event_for_booking(
        session,
        client.id,
        event_id=body.event_id,
        event_name=body.event_name,
        event_date=body.event_date,
        event_end_date=body.event_end_date,
        event_address=body.event_address,
        event_postcode=body.event_postcode,
    )
    search_context = body.client_search_context or None
    values: dict[str, Any] = {
        "client_user_id": client.id,
        "vendor_user_id": vendor_id,
        "event_id": event.event_id,
        "event_name": event.event_name,
        "event_date": event.event_date,
        "event_end_date": event.event_end_date,
        "event_postcode": event.event_postcode,
        "event_address": event.event_address,
        "notes": (body.notes or "").strip() or None,
        "selected_option_ids": body.selected_option_ids,
        "line_items": line_items,
        **_opening_columns(breakdown),
        "initiator": "client",
        "vendor_referral_code": code,
    }
    if search_context is not None:
        values["client_search_context"] = search_context
    booking = await repository.insert_booking(session, values)

    await link_notes_thread(session, booking)
    await notices.dispatch_booking_notification(
        session, mailer, user_id=vendor_id, booking_id=booking.id, kind="booking_request_received"
    )
    await repository.update_booking(session, booking.id, {}, now_columns=("vendor_notified_at",))
    await _record_enquiry_events(session, booking, search_context)
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=client.id,
        booking_id=booking.id,
        kind="booking_request_sent",
        mode="insert_if_absent",
        portal="client",
    )
    announce_change(session, booking)
    await planner.touch_event(session, event.event_id)
    return BookingRequestCreated.model_validate(
        {
            "id": booking.id,
            "status": booking.status,
            "created_at": booking.created_at,
            "event_id": event.event_id,
        }
    )


async def _require_quotable_client(session: AsyncSession, client_user_id: str) -> None:
    """The quote must go to an existing, active client account."""
    account = await accounts.lookup_account(session, client_user_id)
    if account is None:
        raise QuoteClientNotFound()
    if account.user_type != "client":
        raise QuotesClientOnly()
    if account.account_suspended:
        raise QuoteClientSuspended()


async def create_quote(
    session: AsyncSession, mailer: Mailer, vendor: Principal, body: CreateVendorQuoteBody
) -> BookingRequestCreated:
    """A vendor sends a client a priced quote; it waits for the client to accept or decline."""
    client_id = body.client_user_id.strip()
    if as_uuid(client_id) is None:
        raise InvalidClientId()
    conversation_id = (body.conversation_id or "").strip() or None
    if conversation_id is not None and as_uuid(conversation_id) is None:
        raise InvalidConversationId()
    if client_id == vendor.id:
        raise CannotQuoteSelf()
    payload = await service_explore.bookable_vendor_payload(session, vendor.id, viewer=vendor, operator=True)
    if payload is None:
        raise VendorProfileNotBookable()
    await _require_not_suspended(session, vendor.id)
    await _require_quotable_client(session, client_id)
    requested_lines = [line.model_dump() for line in body.line_items]
    if conversation_id is not None:
        await messaging.require_pair_thread(
            session, conversation_id=conversation_id, client_user_id=client_id, vendor_user_id=vendor.id
        )
    await _check_calendar_and_capacity(session, vendor.id, payload, body.event_date, body.event_end_date)

    line_items = domain.validated_quote_lines(requested_lines)
    breakdown = pricing.build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=float(pricing.BOOKING_SERVICE_FEE_PERCENT),
    )
    if breakdown.has_pricing_tbc:
        raise QuoteLineNeedsPrice()
    if breakdown.vendor_portion_gbp <= 0:
        raise QuoteTotalNotPositive()

    event_name = body.event_name.strip()
    booking = await repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor.id,
            "event_name": event_name,
            "event_date": body.event_date,
            "event_end_date": body.event_end_date,
            "notes": (body.notes or "").strip() or None,
            "selected_option_ids": [],
            "line_items": line_items,
            **_opening_columns(breakdown),
            "initiator": "vendor",
            "event_postcode": None,
            "conversation_id": conversation_id,
        },
    )
    total_label = service_pricing.client_total_label(breakdown)
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=client_id,
        booking_id=booking.id,
        kind="vendor_quote_received",
        body=(
            "You have received a new quote from a vendor.\n\n"
            f"Total: {total_label}. Please review the details and accept or decline when you are ready."
        ),
    )
    if conversation_id is not None:
        await messaging.post_quote_card(
            session,
            conversation_id=conversation_id,
            vendor_user_id=vendor.id,
            client_user_id=client_id,
            booking_request_id=booking.id,
            event_name=event_name,
            total_label=total_label,
        )
    announce_change(session, booking)
    return BookingRequestCreated.model_validate(
        {"id": booking.id, "status": booking.status, "created_at": booking.created_at}
    )
