"""Booking writes against real Postgres: the capacity trigger and conditional status updates."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository
from app.features.bookings.errors import VendorFullOnDate
from app.features.identity import repository as identity_repository

pytestmark = pytest.mark.db


async def new_user(session: AsyncSession, email: str, user_type: str) -> str:
    """A `users` row for one side of a booking."""
    user_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=None,
        account_suspended=False,
    )
    assert user_id is not None
    return user_id


async def new_pair(session: AsyncSession) -> tuple[str, str]:
    """A client and a vendor account."""
    client_id = await new_user(session, "booking-client@example.com", "client")
    vendor_id = await new_user(session, "booking-vendor@example.com", "vendor")
    return client_id, vendor_id


def booking_values(client_id: str, vendor_id: str, event_date: date) -> dict[str, object]:
    """The columns of a minimal pending booking on `event_date`."""
    return {
        "client_user_id": client_id,
        "vendor_user_id": vendor_id,
        "event_name": "Wedding",
        "event_date": event_date,
        "total_label": "GBP 100.00",
        "status": "pending",
    }


async def test_the_capacity_trigger_refuses_a_second_open_booking_on_a_full_day(
    db_session: AsyncSession,
) -> None:
    """The second request for the vendor's only slot becomes the friendly `VendorFullOnDate`."""
    client_id, vendor_id = await new_pair(db_session)
    first = await repository.insert_booking(
        db_session, booking_values(client_id, vendor_id, date(2099, 6, 1))
    )
    assert first.status == "pending"
    with pytest.raises(VendorFullOnDate):
        await repository.insert_booking(db_session, booking_values(client_id, vendor_id, date(2099, 6, 1)))
    # The savepoint kept the transaction usable: the vendor still has exactly one open booking.
    assert await repository.open_booking_dates(db_session, vendor_id) == [("2099-06-01", None)]


async def test_a_status_update_only_applies_while_the_status_is_as_read(db_session: AsyncSession) -> None:
    """The loser of a race changes nothing, and so does the other party's id."""
    client_id, vendor_id = await new_pair(db_session)
    booking = await repository.insert_booking(
        db_session, booking_values(client_id, vendor_id, date(2099, 6, 2))
    )
    assert not await repository.update_booking(
        db_session, booking.id, {"status": "accepted"}, vendor_user_id=client_id, status_in=("pending",)
    )
    assert await repository.update_booking(
        db_session,
        booking.id,
        {"status": "accepted"},
        vendor_user_id=vendor_id,
        status_in=("pending",),
        now_columns=("accepted_at",),
    )
    assert not await repository.update_booking(
        db_session, booking.id, {"status": "declined"}, vendor_user_id=vendor_id, status_in=("pending",)
    )
    stored = await repository.get_booking(db_session, booking.id, client_user_id=client_id)
    assert stored is not None
    assert stored.status == "accepted"


async def test_a_completion_confirmation_is_stamped_once(db_session: AsyncSession) -> None:
    """`unset_column` makes a repeated confirmation a no-op."""
    client_id, vendor_id = await new_pair(db_session)
    booking = await repository.insert_booking(
        db_session, booking_values(client_id, vendor_id, date(2099, 6, 3))
    )
    column = "client_completion_confirmed_at"

    async def confirm() -> bool:
        """The client's confirmation, as the completion service writes it."""
        return await repository.update_booking(
            db_session,
            booking.id,
            {},
            client_user_id=client_id,
            unset_column=column,
            now_columns=(column,),
        )

    assert await confirm()
    assert not await confirm()
    stored = await repository.get_booking(db_session, booking.id)
    assert stored is not None
    assert stored.client_completion_confirmed_at is not None
