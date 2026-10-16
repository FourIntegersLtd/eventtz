"""Super admin restores a vendor's Stripe Connect account from their latest payout, over HTTP.

The acceptance suite runs the api with no Stripe key, so it only proves the auth gates
and the "not configured" refusal. What Stripe is asked, what the vendor row holds and
what is audited is proved here with `FakePaymentGateway`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import PaymentGatewayError
from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.staff.models import AdminAuditLog
from app.features.vendors import repository as vendors_repository
from tests.conftest import MakeActor
from tests.support.fakes import FakePaymentGateway

pytestmark = [pytest.mark.db, pytest.mark.e2e]

LOST_ACCOUNT_ID = "acct_test_lost"


def _restore_url(vendor_user_id: str) -> str:
    """The restore-Connect path for a vendor."""
    return f"/api/v1/admin/vendors/{vendor_user_id}/restore-stripe-connect"


def _bearer(token: str) -> dict[str, str]:
    """Authorization header for a token."""
    return {"Authorization": f"Bearer {token}"}


async def _super_admin(make_actor: MakeActor) -> dict[str, str]:
    """Headers for a fresh super admin."""
    return _bearer(await make_actor("restore-super@example.com", user_type="admin", admin_role="super_admin"))


async def _vendor_with_payout(session: AsyncSession, *, transfer_ids: list[tuple[str, str]]) -> str:
    """A vendor whose Connect account was lost, with one paid-out booking per (transfer id, paid_at)."""
    client_id = await _make_account(session, "restore-client@example.com", "client")
    vendor_id = await _make_account(session, "restore-vendor@example.com", "vendor")
    saved = await vendors_repository.save_profile(
        session, vendor_id, {"payload": {"businessName": "Restore Test Catering"}}, exists=False
    )
    assert saved
    for transfer_id, paid_at in transfer_ids:
        await bookings_repository.insert_booking(
            session,
            {
                "client_user_id": client_id,
                "vendor_user_id": vendor_id,
                "event_name": "Restore test party",
                "event_date": paid_at[:10],
                "event_address": "1 Test Street, London",
                "status": "accepted",
                "payment_status": "payout_released",
                "initiator": "client",
                "total_label": "GBP 157.50",
                "stripe_transfer_id": transfer_id,
                "paid_at": paid_at,
            },
        )
    return vendor_id


async def _make_account(session: AsyncSession, email: str, user_type: str) -> str:
    """A verified account of the given type; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def _audit_entries(session: AsyncSession, vendor_id: str) -> list[tuple[str, dict[str, Any]]]:
    """The admin audit log for the vendor as (action, payload)."""
    result = await session.execute(select(AdminAuditLog).where(AdminAuditLog.entity_id == vendor_id))
    return [(entry.action, entry.payload) for entry in result.scalars()]


async def test_restore_requires_sign_in(client: AsyncClient) -> None:
    """No session: 401."""
    response = await client.post(_restore_url("00000000-0000-4000-8000-000000000000"))
    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


async def test_restore_is_forbidden_for_a_client(client: AsyncClient, make_actor: MakeActor) -> None:
    """A client is stopped by the admin gate."""
    token = await make_actor("restore-gate-client@example.com")
    response = await client.post(_restore_url("00000000-0000-4000-8000-000000000000"), headers=_bearer(token))
    assert (response.status_code, response.json()["code"]) == (403, "wrong_portal")


async def test_restore_is_forbidden_for_a_plain_admin(client: AsyncClient, make_actor: MakeActor) -> None:
    """A plain admin is stopped by the super-admin gate."""
    token = await make_actor("restore-gate-admin@example.com", user_type="admin", admin_role="admin")
    response = await client.post(_restore_url("00000000-0000-4000-8000-000000000000"), headers=_bearer(token))
    assert response.status_code == 403
    assert response.json() == {
        "detail": "Only super admins can perform this action.",
        "code": "super_admin_only",
    }


async def test_restore_without_stripe_configured_is_a_400(
    client: AsyncClient, make_actor: MakeActor, payment_gateway: FakePaymentGateway
) -> None:
    """No Stripe key: refused before anything is looked up."""
    payment_gateway.configured = False
    response = await client.post(
        _restore_url("00000000-0000-4000-8000-000000000000"), headers=await _super_admin(make_actor)
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Stripe is not configured.", "code": "stripe_not_configured"}


async def test_restore_without_a_payout_transfer_is_a_400(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A vendor never paid out has nothing to restore from, and Stripe is not asked."""
    vendor_id = await _vendor_with_payout(db_session, transfer_ids=[])
    response = await client.post(_restore_url(vendor_id), headers=await _super_admin(make_actor))
    assert response.status_code == 400
    assert response.json() == {
        "detail": "No payout transfer found for this vendor.",
        "code": "payout_transfer_not_found",
    }
    assert payment_gateway.calls == []


async def test_restore_from_a_transfer_without_a_destination_is_a_400(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A Transfer with no `acct_` destination cannot name the account."""
    vendor_id = await _vendor_with_payout(
        db_session, transfer_ids=[("tr_test_nodest", "2020-06-02T10:00:00+00:00")]
    )
    payment_gateway.objects["tr_test_nodest"] = {"id": "tr_test_nodest", "destination": None}
    response = await client.post(_restore_url(vendor_id), headers=await _super_admin(make_actor))
    assert response.status_code == 400
    assert response.json() == {
        "detail": "Could not resolve Connect account from the payout transfer.",
        "code": "connect_account_resolve_failed",
    }


async def test_restore_when_stripe_fails_is_a_502(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Any Stripe failure is the baseline's 502, after the one Transfer read."""
    vendor_id = await _vendor_with_payout(
        db_session, transfer_ids=[("tr_test_down", "2020-06-02T10:00:00+00:00")]
    )
    payment_gateway.error = PaymentGatewayError("Stripe is down", http_status=500)
    response = await client.post(_restore_url(vendor_id), headers=await _super_admin(make_actor))
    assert response.status_code == 502
    assert response.json() == {
        "detail": "Could not restore Stripe Connect.",
        "code": "stripe_connect_restore_failed",
    }
    assert [call.name for call in payment_gateway.calls] == ["retrieve_transfer"]


async def test_restore_stores_the_latest_transfers_account_and_audits_it(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The newest payout's destination becomes the vendor's account, with Stripe's flags, and is audited."""
    vendor_id = await _vendor_with_payout(
        db_session,
        transfer_ids=[
            ("tr_test_old", "2020-05-01T10:00:00+00:00"),
            ("tr_test_new", "2020-06-02T10:00:00+00:00"),
        ],
    )
    payment_gateway.objects["tr_test_new"] = {"id": "tr_test_new", "destination": LOST_ACCOUNT_ID}
    payment_gateway.objects[LOST_ACCOUNT_ID] = {
        "id": LOST_ACCOUNT_ID,
        "charges_enabled": True,
        "payouts_enabled": False,
    }

    response = await client.post(_restore_url(vendor_id), headers=await _super_admin(make_actor))

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "user_id": vendor_id,
        "stripe_account_id": LOST_ACCOUNT_ID,
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": False,
        "restored_from_transfer_id": "tr_test_new",
    }
    assert [(call.name, call.arguments) for call in payment_gateway.calls] == [
        ("retrieve_transfer", {"transfer_id": "tr_test_new"}),
        ("retrieve_account", {"account_id": LOST_ACCOUNT_ID}),
    ]
    vendor = await vendors_repository.get_vendor(db_session, vendor_id)
    assert vendor is not None
    assert (vendor.stripe_account_id, vendor.stripe_charges_enabled, vendor.stripe_payouts_enabled) == (
        LOST_ACCOUNT_ID,
        True,
        False,
    )
    assert await _audit_entries(db_session, vendor_id) == [
        (
            "vendor.stripe_connect_restored",
            {"stripe_account_id": LOST_ACCOUNT_ID, "restored_from_transfer_id": "tr_test_new"},
        )
    ]
