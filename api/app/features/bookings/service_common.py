"""Steps several booking flows share: checking the path id, telling both screens, linking the notes thread,
and the checks before a cancel."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid
from app.core.events import publish_after_commit, user_topic
from app.features.bookings import domain, repository
from app.features.bookings.domain import BOOKING_CHANGED
from app.features.bookings.errors import CancelNeedsPayments, CancelOpenDispute, InvalidBookingId
from app.features.bookings.rows import BookingRow
from app.features.messaging import service_bookings as messaging


def require_booking_id(booking_id: str) -> str:
    """The path's booking id, refused unless it is a UUID."""
    if as_uuid(booking_id) is None:
        raise InvalidBookingId()
    return booking_id


def announce_change(session: AsyncSession, booking: BookingRow) -> None:
    """Tell the client's and vendor's open screens the booking changed, once the change commits."""
    for user_id in (booking.client_user_id, booking.vendor_user_id):
        if user_id:
            publish_after_commit(session, user_topic(user_id), BOOKING_CHANGED)


async def link_notes_thread(session: AsyncSession, booking: BookingRow) -> str | None:
    """Post the client's notes in their thread with the vendor (once) and store that thread on the booking."""
    thread_id = await messaging.post_booking_notes(
        session,
        booking_id=booking.id,
        client_user_id=booking.client_user_id,
        vendor_user_id=booking.vendor_user_id,
        notes=booking.notes,
        conversation_id=booking.conversation_id,
    )
    if thread_id and thread_id != booking.conversation_id:
        await repository.update_booking(session, booking.id, {"conversation_id": thread_id})
    return thread_id


async def check_may_cancel(session: AsyncSession, booking: BookingRow) -> None:
    """Refuse a cancel the money state or an open problem report forbids.

    A booking mid-checkout or paid also needs Stripe (close the checkout, refund in
    full); that belongs to the payments slice, so until it is rebuilt such a cancel
    is refused rather than leaving money behind.
    """
    domain.check_cancel_money_state(status=booking.status, payment_status=booking.payment_status)
    if await repository.has_active_dispute(session, booking.id):
        raise CancelOpenDispute()
    if booking.payment_status in ("pending", "paid"):
        raise CancelNeedsPayments()
