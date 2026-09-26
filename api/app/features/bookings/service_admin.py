"""Use cases for the admin bookings console: list, detail, payment-field fixes, checkout
reset and support hold. Every write is audited through the staff slice.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import PaymentGateway, PaymentGatewayError
from app.core.settings import get_settings
from app.features.bookings import repository_admin, service_admin_diagnostics
from app.features.bookings.errors import (
    AdminBookingNotFound,
    CouldNotUpdatePaymentFields,
    NoPaymentFieldsToUpdate,
    OnlyUnpaidOrPendingCanBeReset,
    StripeChargeMismatch,
    StripeChargeUnverified,
    StripePaymentIntentNoConfirmedAmount,
    StripePaymentIntentRequiredForAmount,
    StripeVerificationFailed,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas_admin import (
    AdminBookingDetail,
    AdminBookingDetailResponse,
    AdminBookingListItem,
    AdminBookingListSupportSummary,
    AdminBookingsListResponse,
    AdminBookingSupportMeta,
    AdminPaymentFieldsPatchBody,
    AdminPaymentFieldsPatchResponse,
    AdminSupportHoldBody,
)
from app.features.identity import service as identity
from app.features.staff import service as staff_service
from app.features.vendors import service_listing as vendor_listing

# Re-exported so `router_admin.py` can import every schema it needs from this one module: the
# router-thin guard only lets a router reach a sibling module named `schemas`/`errors` or one
# starting with `service`, and `schemas_admin` matches neither (see `vendors/service_ai.py`
# for the same pattern).
__all__ = [
    "AdminBookingDetailResponse",
    "AdminBookingsListResponse",
    "AdminPaymentFieldsPatchBody",
    "AdminPaymentFieldsPatchResponse",
    "AdminSupportHoldBody",
    "get_booking_detail",
    "list_bookings",
    "patch_payment_fields",
    "reset_checkout",
    "set_support_hold",
]

# Vendor display name for a booking whose vendor has no profile row yet (baseline parity).
_UNKNOWN_VENDOR_NAME = "Vendor"


def _blank_to_none(value: str | None) -> str | None:
    """Trimmed text, or `None` for blank text (an admin clearing a field sends `""`)."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


async def list_bookings(
    session: AsyncSession,
    *,
    offset: int,
    limit: int,
    status: str | None,
    date_from: str | None,
    date_to: str | None,
    search: str | None,
) -> tuple[list[AdminBookingListItem], int]:
    """A page of the admin bookings list, across every party, with each row's support summary."""
    clamped_offset = max(0, offset)
    clamped_limit = max(1, min(limit, 200))
    bookings, total = await repository_admin.list_admin_bookings(
        session,
        offset=clamped_offset,
        limit=clamped_limit,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    if not bookings:
        return [], total
    return [item async for item in _list_items(session, bookings)], total


async def _list_items(session: AsyncSession, bookings: list[BookingRow]) -> Any:
    """Attach emails, vendor names and diagnostics to a page of bookings, in batched lookups."""
    vendor_ids = [booking.vendor_user_id for booking in bookings]
    party_ids = [booking.client_user_id for booking in bookings] + vendor_ids
    emails = await identity.emails_by_id(session, party_ids)
    vendor_names = await vendor_listing.display_names(session, vendor_ids)
    payouts_enabled = await repository_admin.vendor_payouts_enabled_by_user_id(session, vendor_ids)
    disputed_ids = await repository_admin.booking_ids_with_active_disputes(
        session, [booking.id for booking in bookings]
    )
    hours_after_event = get_settings().booking_payout_auto_release_hours_after_event
    now = datetime.now(UTC)
    for booking in bookings:
        flags = service_admin_diagnostics.build_needs_attention_flags(
            booking,
            now=now,
            hours_after_event=hours_after_event,
            vendor_payouts_enabled=payouts_enabled.get(booking.vendor_user_id, False),
            has_active_dispute=booking.id in disputed_ids,
        )
        support = service_admin_diagnostics.summarize_support(booking, flags)
        yield AdminBookingListItem(
            id=booking.id,
            status=booking.status,
            event_name=booking.event_name,
            event_date=booking.event_date,
            client_email=emails.get(booking.client_user_id),
            vendor_email=emails.get(booking.vendor_user_id),
            vendor_display_name=vendor_names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME),
            created_at=booking.created_at,
            client_total_label=booking.total_label or None,
            paid_at=booking.paid_at,
            payment_status=booking.payment_status,
            support=AdminBookingListSupportSummary(**support),
        )


async def _to_admin_detail(session: AsyncSession, booking: BookingRow) -> AdminBookingDetail:
    """The admin detail view of one booking: resolved party details and its diagnostics."""
    emails = await identity.emails_by_id(session, [booking.client_user_id, booking.vendor_user_id])
    vendor_names = await vendor_listing.display_names(session, [booking.vendor_user_id])
    payouts_enabled = await repository_admin.vendor_payouts_enabled_by_user_id(
        session, [booking.vendor_user_id]
    )
    has_dispute = await repository_admin.has_active_dispute(session, booking.id)
    hours_after_event = get_settings().booking_payout_auto_release_hours_after_event
    support = service_admin_diagnostics.support_meta_for_booking(
        booking,
        hours_after_event=hours_after_event,
        vendor_payouts_enabled=payouts_enabled.get(booking.vendor_user_id, False),
        has_active_dispute=has_dispute,
    )
    return AdminBookingDetail(
        id=booking.id,
        status=booking.status,
        event_name=booking.event_name,
        event_date=booking.event_date,
        event_end_date=booking.event_end_date,
        event_postcode=booking.event_postcode,
        event_address=booking.event_address,
        notes=booking.notes,
        total_label=booking.total_label,
        selected_option_ids=booking.selected_option_ids,
        line_items=booking.line_items,
        vendor_adjustments=booking.vendor_adjustments,
        client_email=emails.get(booking.client_user_id),
        vendor_email=emails.get(booking.vendor_user_id),
        vendor_user_id=booking.vendor_user_id,
        client_user_id=booking.client_user_id,
        vendor_display_name=vendor_names.get(booking.vendor_user_id, _UNKNOWN_VENDOR_NAME),
        created_at=booking.created_at,
        paid_at=booking.paid_at,
        stripe_payment_intent_id=booking.stripe_payment_intent_id,
        stripe_charge_id=booking.stripe_charge_id,
        stripe_checkout_session_id=booking.stripe_checkout_session_id,
        payment_amount_gbp=booking.payment_amount_gbp,
        payment_status=booking.payment_status,
        vendor_amount_gbp=booking.vendor_amount_gbp,
        platform_fee_gbp=booking.platform_fee_gbp,
        stripe_transfer_id=booking.stripe_transfer_id,
        payout_released_at=booking.payout_released_at,
        client_completion_confirmed_at=booking.client_completion_confirmed_at,
        vendor_completion_confirmed_at=booking.vendor_completion_confirmed_at,
        support=AdminBookingSupportMeta(**support),
    )


async def get_booking_detail(session: AsyncSession, staff: Principal, booking_id: str) -> AdminBookingDetail:
    """One booking, admin-eyes view; recorded as a `booking.view` audit event."""
    booking = await repository_admin.get_admin_booking(session, booking_id)
    if booking is None:
        raise AdminBookingNotFound()
    detail = await _to_admin_detail(session, booking)
    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action="booking.view",
        entity_type="booking_request",
        entity_id=booking_id,
        details={},
    )
    return detail


async def patch_payment_fields(
    session: AsyncSession,
    staff: Principal,
    payment_gateway: PaymentGateway,
    booking_id: str,
    patch: dict[str, Any],
) -> None:
    """Write staff-verified Stripe ids and amount onto a booking (super admin only; router enforces that).

    Any of `payment_amount_gbp`, `stripe_payment_intent_id` or `stripe_charge_id`
    being set triggers a Stripe lookup that verifies the payment intent (and,
    when given, that the charge belongs to it) before anything is written.
    """
    if not patch:
        raise NoPaymentFieldsToUpdate()
    booking = await repository_admin.get_admin_booking(session, booking_id)
    if booking is None:
        raise AdminBookingNotFound()

    pi_id = (
        _blank_to_none(patch.get("stripe_payment_intent_id")) if "stripe_payment_intent_id" in patch else None
    )
    charge_id = _blank_to_none(patch.get("stripe_charge_id")) if "stripe_charge_id" in patch else None
    amount = patch.get("payment_amount_gbp")

    values: dict[str, Any] = {}
    if "stripe_payment_intent_id" in patch:
        values["stripe_payment_intent_id"] = pi_id
    if "stripe_charge_id" in patch:
        values["stripe_charge_id"] = charge_id

    if amount is not None or pi_id is not None or charge_id is not None:
        resolved_payment_intent_id = pi_id or booking.stripe_payment_intent_id
        if not resolved_payment_intent_id:
            raise StripePaymentIntentRequiredForAmount()
        try:
            payment_intent = await payment_gateway.retrieve_payment_intent(resolved_payment_intent_id)
        except PaymentGatewayError as error:
            raise StripeVerificationFailed() from error
        status = str(payment_intent.get("status") or "").lower()
        amount_received = payment_intent.get("amount_received")
        if not amount_received and status in ("succeeded", "requires_capture"):
            amount_received = payment_intent.get("amount")
        if not isinstance(amount_received, int | float) or amount_received <= 0:
            raise StripePaymentIntentNoConfirmedAmount()
        values["payment_amount_gbp"] = round(float(amount_received) / 100.0, 2)
        values["stripe_payment_intent_id"] = resolved_payment_intent_id
        if charge_id is not None:
            latest_charge = payment_intent.get("latest_charge")
            latest_charge_id = latest_charge.get("id") if isinstance(latest_charge, dict) else latest_charge
            if not latest_charge_id:
                raise StripeChargeUnverified()
            if latest_charge_id != charge_id:
                raise StripeChargeMismatch()

    changed = await repository_admin.update_payment_fields(session, booking_id, values)
    if not changed:
        raise CouldNotUpdatePaymentFields()

    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action="booking.payment_fields.patch",
        entity_type="booking_request",
        entity_id=booking_id,
        details=patch,
    )


async def reset_checkout(session: AsyncSession, staff: Principal, booking_id: str) -> AdminBookingDetail:
    """Clear a stale checkout session and return the booking to unpaid (super admin only)."""
    booking = await repository_admin.get_admin_booking(session, booking_id)
    if booking is None:
        raise AdminBookingNotFound()
    changed = await repository_admin.clear_checkout_session(session, booking_id)
    if not changed:
        raise OnlyUnpaidOrPendingCanBeReset()
    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action="booking.reset_checkout",
        entity_type="booking_request",
        entity_id=booking_id,
        details={},
    )
    updated = await repository_admin.get_admin_booking(session, booking_id)
    assert updated is not None, "just-updated booking vanished mid-request"  # noqa: S101
    return await _to_admin_detail(session, updated)


async def set_support_hold(
    session: AsyncSession, staff: Principal, booking_id: str, *, hold: bool
) -> AdminBookingDetail:
    """Pause or resume automatic payout release (super admin only)."""
    booking = await repository_admin.get_admin_booking(session, booking_id)
    if booking is None:
        raise AdminBookingNotFound()
    await repository_admin.set_support_hold(session, booking_id, hold=hold)
    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action="booking.support_hold",
        entity_type="booking_request",
        entity_id=booking_id,
        details={"hold": hold},
    )
    updated = await repository_admin.get_admin_booking(session, booking_id)
    assert updated is not None, "just-updated booking vanished mid-request"  # noqa: S101
    return await _to_admin_detail(session, updated)
