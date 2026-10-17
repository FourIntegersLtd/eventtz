"""Both parties confirm the event went ahead; then the held payment can go to the vendor.

Confirming is allowed once the event's last day is over and the client has paid.
The first confirmation asks the other party to confirm too, then runs the post-event
step (completion reminder, and the automatic payout once due). Paying the vendor is a
Stripe Transfer made by `service_payments.release_vendor_payout`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer, PaymentGateway
from app.features.bookings import domain, domain_policy, repository, service_maintenance, service_payments
from app.features.bookings.errors import (
    BookingNotFound,
    CompleteNeedsPayment,
    CompleteOnlyAccepted,
    DeliveryNotAwaited,
    EventDayNotOver,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import ConfirmCompletionResponse
from app.features.bookings.service_common import announce_change, check_may_pay_out
from app.features.notifications import service_booking as notices

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


async def confirm_completion(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    party: Party,
    user_id: str,
    booking_id: str,
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
    # A hold or an open problem report refuses the confirmation outright: the screen hides
    # the button while a dispute is open, so reaching here means a stale page.
    await check_may_pay_out(session, booking)

    confirmed_column = f"{party}_completion_confirmed_at"
    if getattr(booking, confirmed_column):
        if booking.client_completion_confirmed_at and booking.vendor_completion_confirmed_at:
            return await service_payments.release_vendor_payout(
                session, mailer, gateway, booking_id=booking.id
            )
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
        return await service_payments.release_vendor_payout(session, mailer, gateway, booking_id=confirmed.id)
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
    # As the baseline did: remind the other party now, and pay out if the automatic date has passed.
    # The response is still the state this confirmation left, as the baseline returned it.
    await service_maintenance.run_post_event_step(session, mailer, gateway, confirmed)
    return _result(confirmed)


async def confirm_delivery(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    client_user_id: str,
    booking_id: str,
) -> ConfirmCompletionResponse:
    """The client confirms they received the vendor's work (photos, video); the rest of the payout goes.

    Only for a split payout whose first part is out and whose rest is still held. The
    confirmation is stamped once; the final payout then runs like any other, so a hold or
    an open problem report still stops it (the confirmation is kept and the job pays later).
    """
    booking = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if booking is None:
        raise BookingNotFound()
    awaiting = (
        booking.status == "completed"
        and booking.payment_status == "paid"
        and bool(booking.upfront_payout_at)
        and not booking.delivery_confirmed_at
    )
    if not awaiting:
        raise DeliveryNotAwaited()
    stamped = await repository.update_booking(
        session,
        booking.id,
        {},
        client_user_id=client_user_id,
        unset_column="delivery_confirmed_at",
        now_columns=("delivery_confirmed_at",),
    )
    if not stamped:
        raise DeliveryNotAwaited()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="delivery_confirmed",
        mode="insert_if_absent",
    )
    confirmed = await repository.get_booking(session, booking.id)
    if confirmed is None:
        raise BookingNotFound()
    if domain_policy.payout_stage(confirmed, datetime.now(UTC)) == "final":
        # A refusal (hold, problem report, Stripe) leaves the rest for the hourly job.
        await service_maintenance.release_final_payout_if_allowed(session, mailer, gateway, confirmed)
    announce_change(session, confirmed)
    stored = await repository.get_booking(session, booking.id)
    return _result(stored or confirmed)
