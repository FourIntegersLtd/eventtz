"""Both parties confirm the event went ahead; then the held payment can go to the vendor.

Confirming is allowed once the event's last day is over and the client has paid.
The first confirmation asks the other party to confirm too. Paying the vendor is a
Stripe transfer owned by the payments slice (not rebuilt yet).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.features.bookings import domain, repository
from app.features.bookings.errors import (
    BookingNotFound,
    CompleteNeedsPayment,
    CompleteOnlyAccepted,
    EventDayNotOver,
    PayoutReleaseNotRebuilt,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import ConfirmCompletionResponse
from app.features.bookings.service_common import announce_change
from app.features.notifications import service_booking as notices
from app.features.vendors import service_profile

Party = Literal["client", "vendor"]

# What the party still to confirm is told, keyed by who just confirmed.
_AWAITING_OTHER_PARTY_BODY: dict[Party, str] = {
    "client": (
        "The client confirmed the event went well.\n\nPlease confirm on your side to receive your payout."
    ),
    "vendor": (
        "The vendor confirmed the event is complete.\n\nPlease confirm on your side so they can be paid."
    ),
}


def _result(booking: BookingRow) -> ConfirmCompletionResponse:
    """The confirm-completion response for the booking as stored."""
    return ConfirmCompletionResponse.model_validate(domain.completion_result(booking))


async def _finalize(session: AsyncSession, mailer: Mailer, booking: BookingRow) -> ConfirmCompletionResponse:
    """Both confirmed: hold the payout until Stripe can pay the vendor, else release it."""
    if not await service_profile.payout_route_ready(session, booking.vendor_user_id):
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="payout_held_connect_incomplete",
            mode="insert_if_absent",
            body=(
                "Both of you confirmed the event is complete. We are holding your payout until you finish "
                "Stripe payout setup.\n\nOpen Payouts to complete verification so we can send your funds."
            ),
        )
        announce_change(session, booking)
        return _result(booking)
    raise PayoutReleaseNotRebuilt()


async def confirm_completion(
    session: AsyncSession, mailer: Mailer, *, party: Party, user_id: str, booking_id: str
) -> ConfirmCompletionResponse:
    """Record that this party confirms the event went ahead (once), and finalize when both have."""
    client_user_id = user_id if party == "client" else None
    vendor_user_id = user_id if party == "vendor" else None
    booking = await repository.get_booking(
        session, booking_id, client_user_id=client_user_id, vendor_user_id=vendor_user_id
    )
    if booking is None:
        raise BookingNotFound()
    if booking.status != "accepted":
        raise CompleteOnlyAccepted()
    if booking.payment_status != "paid":
        raise CompleteNeedsPayment()

    confirmed_column = f"{party}_completion_confirmed_at"
    if getattr(booking, confirmed_column):
        if booking.client_completion_confirmed_at and booking.vendor_completion_confirmed_at:
            return await _finalize(session, mailer, booking)
        return _result(booking)
    if not domain.event_day_over(booking, datetime.now(UTC)):
        raise EventDayNotOver()

    changed = await repository.update_booking(
        session,
        booking.id,
        {},
        unset_column=confirmed_column,
        now_columns=(confirmed_column,),
        client_user_id=client_user_id,
        vendor_user_id=vendor_user_id,
    )
    confirmed = await repository.get_booking(session, booking.id) if changed else None
    if confirmed is None:
        raise BookingNotFound()
    if confirmed.client_completion_confirmed_at and confirmed.vendor_completion_confirmed_at:
        return await _finalize(session, mailer, confirmed)
    waiting_user_id = confirmed.vendor_user_id if party == "client" else confirmed.client_user_id
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=waiting_user_id,
        booking_id=confirmed.id,
        kind="completion_confirmed_awaiting_other_party",
        body=_AWAITING_OTHER_PARTY_BODY[party],
    )
    announce_change(session, confirmed)
    return _result(confirmed)
