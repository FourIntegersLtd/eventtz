"""Rescheduling: one party proposes new dates, the other accepts or declines, the proposer withdraws.

Only an accepted booking (unpaid or paid) can be moved. Accepting moves the dates and
nothing else: price, line items, cancellation policy snapshot and payment are untouched.
Every write is conditional so two racing answers cannot both win. The database
daily-capacity trigger has the last word when the move lands on a full day.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.core.time import uk_today
from app.features.bookings import domain, repository
from app.features.bookings.errors import (
    BookingNotFound,
    DateChangeCapacityFull,
    DateChangeInPast,
    DateChangeNotAllowed,
    DateChangeNotYours,
    DateChangePending,
    NoDateChange,
    VendorFullOnDate,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.service_common import announce_change
from app.features.notifications import service_booking as notices

Role = Literal["client", "vendor"]

_CLEARED_PROPOSAL: dict[str, object] = {
    "proposed_event_date": None,
    "proposed_event_end_date": None,
    "date_change_requested_by": None,
    "date_change_note": None,
}
_CLEARED_PROPOSAL_WITH_TIME: dict[str, object] = {**_CLEARED_PROPOSAL, "date_change_requested_at": None}


def _other(role: Role) -> Role:
    """The other party on a booking."""
    return "vendor" if role == "client" else "client"


def _user_id(booking: BookingRow, role: Role) -> str:
    """The user id of `role` on the booking."""
    return booking.client_user_id if role == "client" else booking.vendor_user_id


async def _booking_for(session: AsyncSession, role: Role, user_id: str, booking_id: str) -> BookingRow:
    """The caller's booking, or `BookingNotFound`."""
    if role == "client":
        booking = await repository.get_booking(session, booking_id, client_user_id=user_id)
    else:
        booking = await repository.get_booking(session, booking_id, vendor_user_id=user_id)
    if booking is None:
        raise BookingNotFound()
    return booking


def _check_new_dates(event_date: date, event_end_date: date | None, now: datetime | None = None) -> None:
    """Refuse a start before today (London), an end before the start, or an over-long span."""
    if event_date < uk_today(now) or (event_end_date is not None and event_end_date < event_date):
        raise DateChangeInPast()
    domain.event_days(event_date, event_end_date)


async def _notify(
    session: AsyncSession, mailer: Mailer, booking: BookingRow, *, recipient: Role, kind: str
) -> None:
    """Tell `recipient` about the date change (copy comes from the notification kind) and refresh screens."""
    await notices.dispatch_booking_notification(
        session, mailer, user_id=_user_id(booking, recipient), booking_id=booking.id, kind=kind
    )
    announce_change(session, booking)


async def request_date_change(
    session: AsyncSession,
    mailer: Mailer,
    role: Role,
    user_id: str,
    booking_id: str,
    new_event_date: date,
    new_event_end_date: date | None,
    note: str | None,
) -> None:
    """Propose new dates on an accepted booking; the other party is asked to agree."""
    booking = await _booking_for(session, role, user_id, booking_id)
    if booking.status != "accepted" or booking.payment_status not in ("unpaid", "paid"):
        raise DateChangeNotAllowed()
    if booking.date_change_requested_by:
        raise DateChangePending()
    _check_new_dates(new_event_date, new_event_end_date)
    changed = await repository.update_booking(
        session,
        booking.id,
        {
            "proposed_event_date": new_event_date,
            "proposed_event_end_date": new_event_end_date,
            "date_change_requested_by": role,
            "date_change_note": (note or "").strip() or None,
        },
        status_in=("accepted",),
        payment_status_in=("unpaid", "paid"),
        unset_column="date_change_requested_by",
        now_columns=("date_change_requested_at",),
    )
    if not changed:
        raise DateChangePending()
    await _notify(session, mailer, booking, recipient=_other(role), kind="date_change_requested")


async def respond_to_date_change(
    session: AsyncSession,
    mailer: Mailer,
    role: Role,
    user_id: str,
    booking_id: str,
    *,
    accept: bool,
) -> None:
    """The other party accepts (dates move, reminders reset) or declines (proposal cleared)."""
    booking = await _booking_for(session, role, user_id, booking_id)
    if booking.status != "accepted":
        raise DateChangeNotAllowed()
    if not booking.date_change_requested_by or not booking.proposed_event_date:
        raise NoDateChange()
    if booking.date_change_requested_by == role:
        raise DateChangeNotYours()
    values = dict(_CLEARED_PROPOSAL_WITH_TIME)
    if accept:
        values.update(
            event_date=date.fromisoformat(booking.proposed_event_date[:10]),
            event_end_date=(
                date.fromisoformat(booking.proposed_event_end_date[:10])
                if booking.proposed_event_end_date
                else None
            ),
            # Reminders follow the new date, so the "event tomorrow" and completion nudges fire again.
            completion_reminder_sent_at=None,
            event_tomorrow_reminded_at=None,
        )
        # Capacity-trigger rejections surface as VendorFullOnDate from the repository.
        changed = await _apply_move(session, booking.id, values)
    else:
        changed = await repository.update_booking(session, booking.id, values, status_in=("accepted",))
    if not changed:
        raise NoDateChange()
    await _notify(
        session,
        mailer,
        booking,
        recipient=_other(role),
        kind="date_change_accepted" if accept else "date_change_declined",
    )


async def _apply_move(session: AsyncSession, booking_id: str, values: dict[str, object]) -> bool:
    """Write the accepted move, turning a full-day rejection into `DateChangeCapacityFull`."""
    try:
        return await repository.apply_date_change(session, booking_id, values)
    except VendorFullOnDate as error:
        raise DateChangeCapacityFull() from error


async def withdraw_date_change(
    session: AsyncSession, mailer: Mailer, role: Role, user_id: str, booking_id: str
) -> None:
    """The requester takes their proposal back; the other party is told."""
    booking = await _booking_for(session, role, user_id, booking_id)
    if not booking.date_change_requested_by:
        raise NoDateChange()
    if booking.date_change_requested_by != role:
        raise DateChangeNotYours()
    changed = await repository.update_booking(
        session, booking.id, dict(_CLEARED_PROPOSAL_WITH_TIME), status_in=("accepted",)
    )
    if not changed:
        raise NoDateChange()
    await _notify(session, mailer, booking, recipient=_other(role), kind="date_change_withdrawn")
