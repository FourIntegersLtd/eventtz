"""Booking status changes: the vendor accepts, declines or cancels; the client answers or cancels.

Every write is conditional on the status the caller read, so two racing answers
cannot both win; the loser sees "Booking not found." as the baseline answered.
Each change tells the other party (notification and email) and both open screens.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer, PaymentGateway
from app.features.bookings import domain, domain_cancellation, repository, service_payments, service_pricing
from app.features.bookings.errors import (
    AcceptOnlyPendingOrDeclined,
    BookingNotFound,
    CancelOnlyAcceptedOrQuote,
    CancelOnlyPendingOrAccepted,
    ClientMustAcceptQuote,
    ClientMustConfirmPrice,
    DeclineOnlyPending,
    NothingToRespondTo,
    PayoutSetupRequired,
    RefundedButBookingChanged,
    RespondOnlyPending,
    WithdrawQuoteWithCancel,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import VendorBookingStatusResponse
from app.features.bookings.service_common import announce_change, check_may_cancel
from app.features.identity import service as identity
from app.features.marketplace import service_events as events
from app.features.notifications import service_booking as notices
from app.features.pricing import service as pricing
from app.features.vendors import service_profile

VendorStatus = Literal["accepted", "declined", "cancelled"]
ClientAnswer = Literal["accepted", "declined"]


def _status_response(
    booking_id: str, status: str, *, refund_percent: int | None = None, refund_gbp: float | None = None
) -> VendorBookingStatusResponse:
    """The booking's id and its status after the change (and, for a client cancel, the refund made)."""
    return VendorBookingStatusResponse.model_validate(
        {"id": booking_id, "status": status, "refund_percent": refund_percent, "refund_gbp": refund_gbp}
    )


async def _vendor_booking(session: AsyncSession, vendor_user_id: str, booking_id: str) -> BookingRow:
    """The vendor's booking, or `BookingNotFound`."""
    booking = await repository.get_booking(session, booking_id, vendor_user_id=vendor_user_id)
    if booking is None:
        raise BookingNotFound()
    return booking


async def _client_booking(session: AsyncSession, client_user_id: str, booking_id: str) -> BookingRow:
    """The client's booking, or `BookingNotFound`."""
    booking = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if booking is None:
        raise BookingNotFound()
    return booking


# --- vendor ------------------------------------------------------------------------------------------


async def _vendor_cancel(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> VendorBookingStatusResponse:
    """Cancel an accepted booking (a paid one is refunded in full), or withdraw the vendor's own quote."""
    withdrawing_quote = booking.status == "pending" and booking.initiator == "vendor"
    if booking.status != "accepted" and not withdrawing_quote:
        raise CancelOnlyAcceptedOrQuote()
    refunded = False
    if not withdrawing_quote:
        await check_may_cancel(session, booking)
        settlement = await service_payments.prepare_cancel(
            session, mailer, gateway, booking, cancelled_by="vendor"
        )
        refunded = settlement.refunded
    changed = await repository.update_booking(
        session,
        booking.id,
        {"status": "cancelled", "cancelled_by": "vendor"},
        vendor_user_id=booking.vendor_user_id,
        status_in=(booking.status,),
        now_columns=("cancelled_at",),
    )
    if not changed:
        raise RefundedButBookingChanged() if refunded else BookingNotFound()
    if withdrawing_quote:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="vendor_quote_withdrawn",
            body=(
                "The vendor withdrew their quote.\n\n"
                "This booking is no longer active. You can message them or explore other vendors."
            ),
        )
    elif refunded:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="booking_cancelled_by_vendor",
            body=(
                "The vendor has cancelled this booking. Your payment has been refunded in full.\n\n"
                "It should reach your card within 5-10 working days, depending on your bank."
            ),
        )
    else:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="booking_cancelled_by_vendor",
            mode="insert_if_absent",
        )
    announce_change(session, booking)
    return _status_response(booking.id, "cancelled")


async def _vendor_accept(
    session: AsyncSession, mailer: Mailer, booking: BookingRow
) -> VendorBookingStatusResponse:
    """Accept a pending client request (or re-accept one the vendor declined).

    The vendor must have accepted the current Terms first.
    """
    await identity.require_current_terms(session, booking.vendor_user_id)
    if booking.initiator == "vendor":
        raise ClientMustAcceptQuote()
    if not await service_profile.payouts_ready_for_bookings(session, booking.vendor_user_id):
        raise PayoutSetupRequired()
    if booking.status not in ("pending", "declined"):
        raise AcceptOnlyPendingOrDeclined()
    if domain.price_confirmation_required(booking):
        raise ClientMustConfirmPrice()
    await repository.stamp_first_response(session, booking.id)
    changed = await repository.update_booking(
        session,
        booking.id,
        {"status": "accepted", "failure_reason": None, "failure_noted_at": None},
        vendor_user_id=booking.vendor_user_id,
        status_in=(booking.status,),
        now_columns=("accepted_at",),
    )
    if not changed:
        raise BookingNotFound()
    breakdown = await service_pricing.current_breakdown(session, booking)
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="booking_accepted",
        body=domain.pricing_explanation_body(
            lead_sentence="Good news - your booking was accepted.",
            total_label=breakdown.client_total_label or booking.total_label,
            adjustments=service_pricing.adjustments_view(breakdown),
        ),
    )
    announce_change(session, booking)
    if booking.status == "pending":
        await events.record_marketplace_event(
            session,
            "vendor_accepted_booking",
            actor_user_id=booking.vendor_user_id,
            vendor_user_id=booking.vendor_user_id,
            booking_request_id=booking.id,
        )
    return _status_response(booking.id, "accepted")


async def _vendor_decline(
    session: AsyncSession, mailer: Mailer, booking: BookingRow
) -> VendorBookingStatusResponse:
    """Decline a pending client request."""
    if booking.initiator == "vendor":
        raise WithdrawQuoteWithCancel()
    if booking.status != "pending":
        raise DeclineOnlyPending()
    await repository.stamp_first_response(session, booking.id)
    changed = await repository.update_booking(
        session,
        booking.id,
        {"status": "declined", "failure_reason": domain.FAILURE_VENDOR_UNAVAILABLE},
        vendor_user_id=booking.vendor_user_id,
        status_in=("pending",),
        now_columns=("declined_at", "failure_noted_at"),
    )
    if not changed:
        raise BookingNotFound()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="booking_declined_by_vendor",
        body=(
            "Unfortunately the vendor is unable to take this booking.\n\n"
            "We are sorry that could not work out. You are welcome to browse other vendors "
            "on Eventtz and send a new request whenever you are ready."
        ),
    )
    announce_change(session, booking)
    await events.record_marketplace_event(
        session,
        "vendor_declined_booking",
        actor_user_id=booking.vendor_user_id,
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking.id,
    )
    return _status_response(booking.id, "declined")


async def set_vendor_status(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    vendor_user_id: str,
    booking_id: str,
    new_status: VendorStatus,
) -> VendorBookingStatusResponse:
    """The vendor's answer: pending→accepted/declined, declined→accepted, accepted or own quote→cancelled."""
    booking = await _vendor_booking(session, vendor_user_id, booking_id)
    if new_status == "cancelled":
        return await _vendor_cancel(session, mailer, gateway, booking)
    if new_status == "accepted":
        return await _vendor_accept(session, mailer, booking)
    return await _vendor_decline(session, mailer, booking)


# --- client ------------------------------------------------------------------------------------------


async def cancel_for_client(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, client_user_id: str, booking_id: str
) -> VendorBookingStatusResponse:
    """The client cancels a pending or accepted booking (refunded in full if paid); the vendor is told."""
    booking = await _client_booking(session, client_user_id, booking_id)
    if booking.status == "completed":
        domain.check_cancel_money_state(status=booking.status, payment_status=booking.payment_status)
    if booking.status not in ("pending", "accepted"):
        raise CancelOnlyPendingOrAccepted()
    await check_may_cancel(session, booking)
    settlement = await service_payments.prepare_cancel(
        session, mailer, gateway, booking, cancelled_by="client"
    )
    changed = await repository.update_booking(
        session,
        booking.id,
        {"status": "cancelled", "cancelled_by": "client"},
        client_user_id=client_user_id,
        status_in=("pending", "accepted"),
        now_columns=("cancelled_at",),
    )
    if not changed:
        raise RefundedButBookingChanged() if settlement.refunded else BookingNotFound()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="booking_cancelled_by_client",
        body=_client_cancelled_vendor_body(booking, settlement),
    )
    announce_change(session, booking)
    await repository.update_booking(
        session,
        booking.id,
        {"failure_reason": domain.FAILURE_CUSTOMER_CANCELLED},
        unset_column="failure_reason",
        now_columns=("failure_noted_at",),
    )
    await events.record_marketplace_event(
        session,
        "booking_cancelled",
        actor_user_id=client_user_id,
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking.id,
    )
    return _status_response(
        booking.id, "cancelled", refund_percent=settlement.refund_percent, refund_gbp=settlement.refund_gbp
    )


def _client_cancelled_vendor_body(booking: BookingRow, settlement: service_payments.CancelSettlement) -> str:
    """What the vendor is told when the client cancels: whether, and how, the money was split."""
    if not settlement.refunded:
        return (
            "The client has cancelled this booking.\n\n"
            "The booking is now closed. You can still message them on Eventtz if you need to."
        )
    if not settlement.partial:
        return (
            "The client has cancelled this booking. Their payment has been refunded in full.\n\n"
            "No further action is needed on your side."
        )
    policy_label = domain_cancellation.preset_label(booking.cancellation_policy)
    share_label = pricing.format_gbp(settlement.vendor_share_gbp or 0.0)
    share_line = (
        f"Your share of {share_label} has been sent to your connected account."
        if settlement.vendor_share_paid
        else f"Your share of {share_label} is held until your Stripe payout setup is complete."
    )
    return (
        f"The client has cancelled this booking. Under your {policy_label} cancellation policy they "
        f"were refunded {settlement.refund_percent}% of your price plus the Eventtz service fee.\n\n"
        f"{share_line}"
    )


async def _decline_updated_price(
    session: AsyncSession, mailer: Mailer, booking: BookingRow
) -> VendorBookingStatusResponse:
    """Put the booking back to its original price; it stays pending for the vendor."""
    owners = await service_pricing.code_owners_for(session, [booking])
    original = service_pricing.initial_breakdown_for(booking, owners)
    changed = await repository.update_booking(
        session,
        booking.id,
        {"vendor_adjustments": [], **service_pricing.snapshot_columns(original)},
        client_user_id=booking.client_user_id,
        status_in=("pending",),
    )
    if not changed:
        raise BookingNotFound()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="client_declined_updated_price",
        body=(
            "The client declined the updated price.\n\n"
            "The booking is still open at the original price. You can message them "
            "or send a new price if needed."
        ),
    )
    announce_change(session, booking)
    return _status_response(booking.id, "pending")


async def _decline_quote(
    session: AsyncSession, mailer: Mailer, booking: BookingRow
) -> VendorBookingStatusResponse:
    """Turn down the vendor's quote; the booking closes."""
    changed = await repository.update_booking(
        session,
        booking.id,
        {"status": "declined"},
        client_user_id=booking.client_user_id,
        status_in=("pending",),
    )
    if not changed:
        raise BookingNotFound()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="vendor_quote_declined",
        body=(
            "The client declined your quote.\n\n"
            "The booking has been closed. You can still message them on Eventtz."
        ),
    )
    announce_change(session, booking)
    return _status_response(booking.id, "declined")


async def _accept(
    session: AsyncSession,
    mailer: Mailer,
    booking: BookingRow,
    *,
    is_vendor_quote: bool,
    event_postcode: str | None,
    event_address: str | None,
) -> VendorBookingStatusResponse:
    """Accept the vendor's quote (with the venue) or the vendor's updated price."""
    values: dict[str, object] = {"status": "accepted"}
    if is_vendor_quote:
        values["event_postcode"] = event_postcode if event_postcode and len(event_postcode) >= 2 else None
        values["event_address"] = event_address
    changed = await repository.update_booking(
        session, booking.id, values, client_user_id=booking.client_user_id, status_in=("pending",)
    )
    if not changed:
        raise BookingNotFound()
    breakdown = await service_pricing.current_breakdown(session, booking)
    total_label = breakdown.client_total_label or booking.total_label
    if is_vendor_quote:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="vendor_quote_accepted",
            body=domain.pricing_explanation_body(
                lead_sentence="The client accepted your quote.",
                total_label=total_label,
                adjustments=service_pricing.adjustments_view(breakdown),
            ),
        )
    else:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="client_confirmed_updated_price",
            body=(
                "The client accepted the updated price.\n\n"
                f"Total due: {total_label}. We will notify you when payment is received."
            ),
        )
    announce_change(session, booking)
    return _status_response(booking.id, "accepted")


async def answer_for_client(
    session: AsyncSession,
    mailer: Mailer,
    client_user_id: str,
    booking_id: str,
    answer: ClientAnswer,
    *,
    event_postcode: str | None,
    event_address: str | None,
) -> VendorBookingStatusResponse:
    """The client accepts or declines a pending vendor quote, or the vendor's updated price."""
    booking = await _client_booking(session, client_user_id, booking_id)
    if booking.status != "pending":
        raise RespondOnlyPending()
    is_vendor_quote = booking.initiator == "vendor"
    is_updated_price = booking.initiator == "client" and domain.price_confirmation_required(booking)
    if not is_vendor_quote and not is_updated_price:
        raise NothingToRespondTo()
    if answer == "declined":
        if is_updated_price:
            return await _decline_updated_price(session, mailer, booking)
        return await _decline_quote(session, mailer, booking)
    return await _accept(
        session,
        mailer,
        booking,
        is_vendor_quote=is_vendor_quote,
        event_postcode=event_postcode,
        event_address=event_address,
    )
