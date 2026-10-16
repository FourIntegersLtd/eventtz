"""Closing one's own account over HTTP against the migrated Postgres.

The acceptance suite freezes the gates' copy and the erased rows; this proves what it
cannot see: the stored files deleted, the refresh token dead, the email sent, the Stripe
Connect account deleted, and that a failing storage service does not stop the closure.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import mailer_port, storage_port
from app.features.bookings import repository as bookings_repository
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.identity.models import User
from app.features.identity.tokens import hash_password
from app.features.vendors import repository as vendors_repository
from tests.conftest import MakeActor
from tests.support.fakes import FakeMailer, FakePaymentGateway, FakeStorage

pytestmark = [pytest.mark.db, pytest.mark.e2e]

DELETION_URL = "/api/v1/user/account/deletion"
PASSWORD = "Correct-horse-9battery"


@pytest.fixture
def mailer(app: FastAPI) -> FakeMailer:
    """The fake mailer every request in the test sends through."""
    fake = FakeMailer()
    app.dependency_overrides[mailer_port] = lambda: fake
    return fake


@pytest.fixture
def storage(app: FastAPI) -> FakeStorage:
    """The fake file storage every request in the test uses."""
    fake = FakeStorage()
    app.dependency_overrides[storage_port] = lambda: fake
    return fake


async def _account(session: AsyncSession, email: str, user_type: str = "client") -> str:
    """A verified account with `PASSWORD`; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        password_hash=hash_password(PASSWORD),
        email_verified_at=None if user_type == "admin" else _now(),
    )
    assert account_id is not None
    return account_id


def _now() -> Any:
    """The current UTC time (a helper so the import stays local to account creation)."""
    from datetime import UTC, datetime  # noqa: PLC0415

    return datetime.now(UTC)


async def _sign_in(client: AsyncClient, email: str) -> dict[str, str]:
    """Sign in and return the session (access and refresh tokens)."""
    signed_in = await client.post("/api/v1/auth/signin", json={"email": email, "password": PASSWORD})
    assert signed_in.status_code == 200, signed_in.text
    session: dict[str, str] = signed_in.json()["session"]
    return session


def _bearer(session: dict[str, str]) -> dict[str, str]:
    """Authorization header for a signed-in session."""
    return {"Authorization": f"Bearer {session['access_token']}"}


async def _booking(session: AsyncSession, client_id: str, vendor_id: str, **values: Any) -> str:
    """A booking between the two accounts; returns its id."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Deletion test party",
            "event_date": "2099-06-01",
            "status": "pending",
            "payment_status": "unpaid",
            "initiator": "client",
            "total_label": "GBP 150",
            **values,
        },
    )
    return booking.id


async def _refused(client: AsyncClient, email: str, password: str = PASSWORD) -> tuple[int, str, str]:
    """Sign in and ask to close the account; returns (status, code, detail)."""
    response = await client.post(
        DELETION_URL, json={"password": password}, headers=_bearer(await _sign_in(client, email))
    )
    body = response.json()
    return response.status_code, body["code"], body["detail"]


async def test_happy_path_tombstones_and_cleans_up(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, storage: FakeStorage
) -> None:
    account_id = await _account(db_session, "closing@example.com")
    signed_in = await _sign_in(client, "closing@example.com")

    response = await client.post(DELETION_URL, json={"password": PASSWORD}, headers=_bearer(signed_in))

    assert (response.status_code, response.json()) == (
        200,
        {"success": True, "message": "Your Eventtz account has been deleted."},
    )
    user = (await db_session.execute(select(User).where(User.id == account_id))).scalar_one()
    await db_session.refresh(user)
    assert user.deleted_at is not None
    assert (user.email, user.preferred_name, user.contact_phone, user.email_verified_at) == (None,) * 4
    assert (user.share_email, user.share_phone, user.share_address, user.account_suspended) == (False,) * 4
    assert storage.deleted_prefixes == [f"users/{account_id}/"]
    assert [(email.to, email.subject) for email in mailer.sent] == [
        (("closing@example.com",), "Account deleted | Eventtz")
    ]
    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": signed_in["refresh_token"]})
    assert refreshed.status_code == 401
    assert (await client.get("/api/v1/auth/me", headers=_bearer(signed_in))).status_code == 401


async def test_signup_with_the_same_email_makes_a_new_account(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, storage: FakeStorage
) -> None:
    old_id = await _account(db_session, "returning@example.com")
    closed = await client.post(
        DELETION_URL,
        json={"password": PASSWORD},
        headers=_bearer(await _sign_in(client, "returning@example.com")),
    )
    assert closed.status_code == 200

    signup = await client.post(
        "/api/v1/auth/signup", json={"email": "returning@example.com", "password": PASSWORD}
    )

    assert signup.status_code == 200, signup.text
    new_id = signup.json()["user"]["id"]
    assert new_id != old_id
    old_user = (await db_session.execute(select(User).where(User.id == old_id))).scalar_one()
    await db_session.refresh(old_user)
    assert (old_user.email, old_user.deleted_at is not None) == (None, True)


async def test_a_failing_storage_does_not_stop_the_closure(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, storage: FakeStorage
) -> None:
    storage.delete_error = RuntimeError("S3 is down")
    await _account(db_session, "storage-down@example.com")

    response = await client.post(
        DELETION_URL,
        json={"password": PASSWORD},
        headers=_bearer(await _sign_in(client, "storage-down@example.com")),
    )

    assert response.status_code == 200
    assert storage.deleted_prefixes == []
    assert len(mailer.sent) == 1


async def test_a_vendor_closure_deletes_the_connect_account(
    client: AsyncClient,
    db_session: AsyncSession,
    mailer: FakeMailer,
    storage: FakeStorage,
    payment_gateway: FakePaymentGateway,
) -> None:
    vendor_id = await _account(db_session, "closing-vendor@example.com", "vendor")
    saved = await vendors_repository.save_profile(
        db_session,
        vendor_id,
        {"payload": {"businessName": "Closing Catering"}, "stripe_account_id": "acct_test_closing"},
        exists=False,
    )
    assert saved

    response = await client.post(
        DELETION_URL,
        json={"password": PASSWORD},
        headers=_bearer(await _sign_in(client, "closing-vendor@example.com")),
    )

    assert response.status_code == 200
    assert [(call.name, call.arguments) for call in payment_gateway.calls] == [
        ("delete_account", {"account_id": "acct_test_closing"})
    ]


async def test_a_wrong_password_is_refused(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, storage: FakeStorage
) -> None:
    await _account(db_session, "wrong-password@example.com")
    assert await _refused(client, "wrong-password@example.com", "not-the-password-1") == (
        400,
        "current_password_incorrect",
        "Current password is incorrect.",
    )
    assert mailer.sent == []


async def test_staff_are_refused(client: AsyncClient, make_actor: MakeActor) -> None:
    token = await make_actor("staff-closing@example.com", user_type="admin")
    response = await client.post(
        DELETION_URL, json={"password": PASSWORD}, headers={"Authorization": f"Bearer {token}"}
    )
    assert (response.status_code, response.json()["code"], response.json()["detail"]) == (
        403,
        "account_deletion_staff",
        "Staff accounts cannot be deleted here. Ask a super admin to remove team access.",
    )


async def test_each_gate_refuses_with_its_code_and_copy(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, storage: FakeStorage
) -> None:
    vendor_id = await _account(db_session, "gate-vendor@example.com", "vendor")
    money_client = await _account(db_session, "gate-money@example.com")
    active_client = await _account(db_session, "gate-active@example.com")
    dispute_client = await _account(db_session, "gate-dispute@example.com")
    await _booking(db_session, money_client, vendor_id, status="accepted", payment_status="paid")
    await _booking(db_session, active_client, vendor_id, status="accepted", event_date="2099-07-01")
    finished = await _booking(
        db_session, dispute_client, vendor_id, status="accepted", event_date="2020-01-01"
    )
    await disputes_repository.insert_dispute(
        db_session,
        booking_request_id=finished,
        opened_by_user_id=dispute_client,
        summary="Seeded for the deletion gate.",
        conversation_id=None,
    )

    assert await _refused(client, "gate-money@example.com") == (
        409,
        "money_in_flight",
        "You have a booking with payment still in progress. "
        "Finish payout or wait for a refund, then try again.",
    )
    assert await _refused(client, "gate-active@example.com") == (
        409,
        "active_booking",
        "You have an accepted booking that has not happened yet. "
        "Complete or cancel it first, then try again.",
    )
    assert await _refused(client, "gate-dispute@example.com") == (
        409,
        "open_dispute",
        "You have an open problem report. Wait until it is resolved, then try again.",
    )
    # The vendor is a party to the paid booking too.
    assert (await _refused(client, "gate-vendor@example.com"))[1] == "money_in_flight"
