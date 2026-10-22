"""A vendor's booking search never reveals a client's email before payment."""

from __future__ import annotations

import pytest
from sqlalchemy import literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository, service_queries
from app.features.identity.domain import friendly_name_from_email
from tests.http.test_bookings_maintenance import _make_booking, _make_parties

pytestmark = [pytest.mark.db]


async def _search(session: AsyncSession, vendor_id: str, term: str) -> list[str]:
    """Event names a vendor's search for `term` returns."""
    items, _total = await service_queries.vendor_bookings_page(
        session,
        vendor_id,
        group="all",
        status=None,
        payment_status=None,
        exclude_payment_status=None,
        search=term,
        offset=0,
        limit=50,
    )
    return [item.event_name for item in items]


async def test_vendor_search_does_not_match_an_unpaid_clients_email(db_session: AsyncSession) -> None:
    """Probing with a fragment of the client's email finds nothing, paid or not."""
    client_id, vendor_id = await _make_parties(db_session, "search-email")
    await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, status="pending", payment_status="unpaid"
    )

    assert await _search(db_session, vendor_id, "search-email-client") == []
    assert await _search(db_session, vendor_id, "@example.com") == []


async def test_vendor_search_still_matches_event_and_client_name(db_session: AsyncSession) -> None:
    """Event name and the client's preferred name (both shown in the list) still match."""
    client_id, vendor_id = await _make_parties(db_session, "search-ok")
    await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, status="pending", payment_status="unpaid"
    )
    await db_session.execute(
        text("UPDATE users SET preferred_name = 'Zelda Quill' WHERE id = :id"), {"id": client_id}
    )

    assert await _search(db_session, vendor_id, "Maintenance") == ["Maintenance party"]
    assert await _search(db_session, vendor_id, "zelda") == ["Maintenance party"]


async def test_vendor_search_matches_the_name_derived_from_the_email_but_not_the_email(
    db_session: AsyncSession,
) -> None:
    """A client shown as "Jane Doe" is found by "jane"; the digits, `@` and domain are not searchable."""
    client_id, vendor_id = await _make_parties(db_session, "unused")
    await db_session.execute(
        text("UPDATE users SET email = 'jane.doe_92@secretdomain.com' WHERE id = :id"), {"id": client_id}
    )
    await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, status="pending", payment_status="unpaid"
    )

    assert await _search(db_session, vendor_id, "jane d") == ["Maintenance party"]
    for probe in ("92", "@", "secretdomain", "jane.doe", "doe_", "example"):
        assert await _search(db_session, vendor_id, probe) == [], probe


async def test_vendor_search_ignores_a_closed_account(db_session: AsyncSession) -> None:
    """A tombstoned client is shown as "Deleted user", so their old name no longer matches."""
    client_id, vendor_id = await _make_parties(db_session, "search-closed")
    await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, status="pending", payment_status="unpaid"
    )
    await db_session.execute(
        text("UPDATE users SET preferred_name = 'Zelda Quill', deleted_at = now() WHERE id = :id"),
        {"id": client_id},
    )

    assert await _search(db_session, vendor_id, "zelda") == []
    assert await _search(db_session, vendor_id, "search-closed") == []


@pytest.mark.parametrize(
    "email",
    [
        "jane.doe_92@example.com",
        "JANE-DOE@example.com",
        "12345@example.com",
        "a.1.b.22.c@example.com",
        "x__y--z@example.com",
        "  spaced.out@example.com",
        "99.100@example.com",
    ],
)
async def test_friendly_name_sql_equals_the_python_derivation(db_session: AsyncSession, email: str) -> None:
    """The SQL used for search and `friendly_name_from_email` (used for display) agree, ignoring case."""
    derived = (await db_session.execute(select(repository._friendly_name_sql(literal(email))))).scalar_one()

    assert derived.lower() == (friendly_name_from_email(email) or "").lower()
