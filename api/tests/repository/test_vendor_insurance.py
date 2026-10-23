"""Public liability insurance against real Postgres: optional for listing and approval, staff checks."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.time import uk_today
from app.features.vendors import repository as vendor_repository
from app.features.vendors import service_moderation
from app.features.vendors.errors import (
    InsuranceAlreadyExpired,
    InsuranceCertificateMissing,
    InsuranceCoverTooLow,
)
from tests.repository.test_booking_writes import new_user
from tests.support.fakes import FakeMailer

pytestmark = pytest.mark.db

CERTIFICATE = "https://cdn.example.com/users/vendor/insurance.pdf"


async def new_vendor(
    session: AsyncSession,
    email: str,
    *,
    services: list[str],
    certificate: str = CERTIFICATE,
    approval_status: str = "approved",
    **columns: object,
) -> str:
    """A submitted vendor offering `services`, forced visible so Stripe does not decide the listing."""
    vendor_id = await new_user(session, email, "vendor")
    await vendor_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "submitted",
            "approval_status": approval_status,
            "listing_override": "visible",
            "services_offered": services,
            "payload": {"servicesOffered": services, "indemnityCertNamePersisted": certificate},
            **columns,
        },
        exists=False,
    )
    return vendor_id


async def new_staff(session: AsyncSession, email: str) -> Principal:
    """A super admin who may check certificates and approve vendors."""
    staff_id = await new_user(session, email, "admin")
    return Principal(id=staff_id, email=None, user_type="admin", admin_role="super_admin")


async def listed_ids(session: AsyncSession, vendor_id: str) -> list[str]:
    """The ids the public listing returns for this vendor."""
    rows = await vendor_repository.marketplace_vendors(session, listed_only=True, user_ids=[vendor_id])
    return [row.user_id for row in rows]


async def test_a_caterer_with_nothing_checked_or_lapsed_cover_stays_listed(db_session: AsyncSession) -> None:
    """Insurance never hides a listing for now, whatever the service."""
    unchecked = await new_vendor(
        db_session, "ins-unchecked@example.com", services=["catering"], certificate=""
    )
    lapsed = await new_vendor(
        db_session,
        "ins-lapsed@example.com",
        services=["baking"],
        insurance_expires_on=uk_today() - timedelta(days=60),
    )
    assert await listed_ids(db_session, unchecked) == [unchecked]
    assert await listed_ids(db_session, lapsed) == [lapsed]


async def test_approving_a_caterer_needs_no_certificate(db_session: AsyncSession) -> None:
    """Staff can approve a caterer who has uploaded nothing."""
    vendor_id = await new_vendor(
        db_session,
        "ins-approve@example.com",
        services=["catering"],
        certificate="",
        approval_status="pending",
    )
    staff_member = await new_staff(db_session, "ins-approve-staff@example.com")
    approved = await service_moderation.set_approval(
        db_session, staff_member, vendor_id, "approved", mailer=FakeMailer()
    )
    assert approved.approval_status == "approved"


async def test_checking_and_withdrawing_a_certificate(db_session: AsyncSession) -> None:
    """A check stores the expiry and cover against the uploaded file; withdrawing clears them."""
    vendor_id = await new_vendor(db_session, "ins-verify@example.com", services=["catering"])
    staff_member = await new_staff(db_session, "ins-verify-staff@example.com")
    expires_on = uk_today() + timedelta(days=200)
    checked = await service_moderation.verify_insurance(
        db_session, staff_member, vendor_id, expires_on=expires_on, cover_gbp=5_000_000
    )
    assert checked.insurance.status == "verified"
    assert checked.insurance.verified_certificate_url == CERTIFICATE
    assert checked.insurance.expires_on == expires_on
    assert checked.insurance.cover_gbp == 5_000_000
    assert checked.listing_visible is True

    withdrawn = await service_moderation.revoke_insurance(db_session, staff_member, vendor_id)
    assert withdrawn.insurance.status == "awaiting_check"
    assert withdrawn.insurance.expires_on is None
    assert withdrawn.insurance.cover_gbp is None
    assert withdrawn.listing_visible is True


async def test_a_check_is_refused_without_a_file_with_low_cover_or_an_ended_date(
    db_session: AsyncSession,
) -> None:
    """Each bad check names its own reason."""
    staff_member = await new_staff(db_session, "ins-refuse-staff@example.com")
    future = uk_today() + timedelta(days=100)
    no_file = await new_vendor(db_session, "ins-nofile@example.com", services=["catering"], certificate="")
    with pytest.raises(InsuranceCertificateMissing):
        await service_moderation.verify_insurance(
            db_session, staff_member, no_file, expires_on=future, cover_gbp=1_000_000
        )
    with_file = await new_vendor(db_session, "ins-withfile@example.com", services=["catering"])
    with pytest.raises(InsuranceCoverTooLow):
        await service_moderation.verify_insurance(
            db_session, staff_member, with_file, expires_on=future, cover_gbp=999_999
        )
    with pytest.raises(InsuranceAlreadyExpired):
        await service_moderation.verify_insurance(
            db_session,
            staff_member,
            with_file,
            expires_on=uk_today() - timedelta(days=1),
            cover_gbp=1_000_000,
        )


async def test_a_check_ending_today_in_london_is_refused_at_london_midnight(db_session: AsyncSession) -> None:
    """At 23:30 UTC on 30 June it is already 1 July in London: cover ending 30 June has ended."""
    staff_member = await new_staff(db_session, "ins-bst-staff@example.com")
    vendor_id = await new_vendor(db_session, "ins-bst@example.com", services=["catering"])
    just_past_midnight = datetime(2026, 6, 30, 23, 30, tzinfo=UTC)
    with pytest.raises(InsuranceAlreadyExpired):
        await service_moderation.verify_insurance(
            db_session,
            staff_member,
            vendor_id,
            expires_on=date(2026, 6, 30),
            cover_gbp=1_000_000,
            now=just_past_midnight,
        )
    checked = await service_moderation.verify_insurance(
        db_session,
        staff_member,
        vendor_id,
        expires_on=date(2026, 7, 2),
        cover_gbp=1_000_000,
        now=just_past_midnight,
    )
    assert checked.insurance.expires_on == date(2026, 7, 2)
