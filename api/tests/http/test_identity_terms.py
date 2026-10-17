"""Terms acceptance over HTTP: /me, the accept endpoint, signup, the vendor gate and the notice email."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import Settings
from app.features.identity import repository
from app.features.identity import service as identity
from app.features.identity.errors import TermsNotAccepted
from tests.http.test_payments_refunds_payouts import _make_account, _make_booking, _make_vendor

pytestmark = [pytest.mark.db, pytest.mark.e2e]


async def _account_without_terms(
    session: AsyncSession, email: str, settings: Settings, *, suspended: bool = False
) -> tuple[str, str]:
    """A verified client who has accepted nothing: (id, bearer token)."""
    account_id = await repository.create_account(
        session,
        email=email,
        user_type="client",
        email_verified_at=datetime.now(UTC),
        account_suspended=suspended,
    )
    assert account_id is not None
    return account_id, issue_access_token(user_id=account_id, email=email, settings=settings)


async def test_me_reports_current_and_accepted_versions(
    client: AsyncClient, db_session: AsyncSession, settings: Settings
) -> None:
    """A user who accepted nothing sees the current version and a null acceptance."""
    _account_id, token = await _account_without_terms(db_session, "terms-me@example.com", settings)

    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    user = response.json()["user"]
    assert (user["terms_version"], user["terms_accepted_version"], user["terms_accepted_at"]) == (
        "2026-11-01",
        None,
        None,
    )


async def test_accepting_the_current_version_is_recorded(
    client: AsyncClient, db_session: AsyncSession, settings: Settings
) -> None:
    """Accepting the current version stamps the version and a time, and gates open."""
    account_id, token = await _account_without_terms(db_session, "terms-accept@example.com", settings)
    assert not await identity.has_accepted_current_terms(db_session, account_id)

    response = await client.post(
        "/api/v1/user/terms/accept",
        json={"version": "2026-11-01"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["terms_accepted_version"] == "2026-11-01"
    assert response.json()["terms_accepted_at"] is not None
    assert await identity.has_accepted_current_terms(db_session, account_id)


async def test_accepting_an_old_version_is_refused(
    client: AsyncClient, db_session: AsyncSession, settings: Settings
) -> None:
    """A stale page cannot record acceptance of a version that is no longer current."""
    account_id, token = await _account_without_terms(db_session, "terms-stale@example.com", settings)

    response = await client.post(
        "/api/v1/user/terms/accept",
        json={"version": "2026-07-01"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "terms_version_mismatch"
    assert not await identity.has_accepted_current_terms(db_session, account_id)


async def test_require_current_terms_raises_until_accepted(
    db_session: AsyncSession, settings: Settings
) -> None:
    """The gate raises TermsNotAccepted for a user who has not accepted."""
    account_id, _token = await _account_without_terms(db_session, "terms-gate@example.com", settings)

    with pytest.raises(TermsNotAccepted):
        await identity.require_current_terms(db_session, account_id)
    await repository.stamp_terms_accepted(db_session, account_id, "2026-11-01")
    await identity.require_current_terms(db_session, account_id)


async def test_signup_with_the_current_version_records_acceptance(client: AsyncClient) -> None:
    """Signup with terms_version records it; without it signup still works and records nothing."""
    with_terms = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "terms-signup@example.com",
            "password": "Correct-horse-9battery",
            "terms_version": "2026-11-01",
        },
    )
    without_terms = await client.post(
        "/api/v1/auth/signup",
        json={"email": "terms-signup-none@example.com", "password": "Correct-horse-9battery"},
    )

    assert with_terms.status_code == without_terms.status_code == 200
    assert with_terms.json()["user"]["terms_accepted_version"] == "2026-11-01"
    assert without_terms.json()["user"]["terms_accepted_version"] is None


async def _pending_booking_for_vendor(
    db_session: AsyncSession, label: str, *, accepted_terms: bool
) -> tuple[str, dict[str, str]]:
    """A pending request to a payouts-ready vendor: (status URL, auth headers)."""
    client_id, _client_token = await _make_account(db_session, f"{label}-client@example.com", "client")
    vendor_id, token = await _make_vendor(db_session, f"{label}-vendor@example.com", stripe_ready=True)
    if accepted_terms:
        await repository.stamp_terms_accepted(db_session, vendor_id, "2026-11-01")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, status="pending", payment_status="unpaid"
    )
    return f"/api/v1/vendor/booking-requests/{booking_id}/status", {"Authorization": f"Bearer {token}"}


async def test_a_vendor_who_has_not_accepted_cannot_accept_a_booking(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Accepting a booking needs the current Terms."""
    url, headers = await _pending_booking_for_vendor(db_session, "terms-gate", accepted_terms=False)

    response = await client.patch(url, json={"status": "accepted"}, headers=headers)

    assert response.status_code == 409
    assert response.json()["code"] == "terms_not_accepted"


async def test_a_vendor_who_accepted_can_accept_a_booking(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """With the current Terms accepted the gate lets the vendor through."""
    url, headers = await _pending_booking_for_vendor(db_session, "terms-open", accepted_terms=True)

    response = await client.patch(url, json={"status": "accepted"}, headers=headers)

    assert response.status_code == 200, response.text
