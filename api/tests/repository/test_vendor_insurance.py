"""Public liability insurance against real Postgres: listing, approval gate, staff checks, reminder."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import OutgoingEmail
from app.features.bookings import service_reminders
from app.features.vendors import repository as vendor_repository
from app.features.vendors import service_moderation
from app.features.vendors.errors import (
    InsuranceAlreadyExpired,
    InsuranceCertificateMissing,
    InsuranceCoverTooLow,
    InsuranceRequiredForApproval,
)
from tests.repository.test_booking_writes import new_user
from tests.support.fakes import FakeMailer

pytestmark = pytest.mark.db

CERTIFICATE = "https://cdn.example.com/users/vendor/insurance.pdf"
# After the rule starts, so a vendor with nothing checked is hidden.
AFTER_RULE = date(2027, 3, 1)
BEFORE_RULE = date(2026, 11, 30)


async def new_vendor(
    session: AsyncSession,
    email: str,
    *,
    services: list[str],
    certificate: str = CERTIFICATE,
    approval_status: str = "approved",
    **columns: object,
) -> str:
    """A submitted vendor offering `services`, forced visible so only insurance decides the listing."""
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


async def listed_ids(session: AsyncSession, vendor_id: str, *, today: date) -> list[str]:
    """The ids the public listing returns for this vendor on `today`."""
    rows = await vendor_repository.marketplace_vendors(
        session, listed_only=True, user_ids=[vendor_id], today=today
    )
    return [row.user_id for row in rows]


async def test_a_caterer_with_nothing_checked_is_listed_only_before_the_rule_starts(
    db_session: AsyncSession,
) -> None:
    """Listed on 30 November 2026, hidden on 1 March 2027 even though forced visible."""
    vendor_id = await new_vendor(db_session, "ins-unchecked@example.com", services=["catering"])
    assert await listed_ids(db_session, vendor_id, today=BEFORE_RULE) == [vendor_id]
    assert await listed_ids(db_session, vendor_id, today=AFTER_RULE) == []


async def test_lapsed_cover_keeps_the_listing_for_14_days(db_session: AsyncSession) -> None:
    """Cover that ended 14 days ago still lists; 15 days ago does not."""
    vendor_id = await new_vendor(
        db_session,
        "ins-lapsed@example.com",
        services=["baking"],
        insurance_expires_on=AFTER_RULE - timedelta(days=14),
    )
    assert await listed_ids(db_session, vendor_id, today=AFTER_RULE) == [vendor_id]
    assert await listed_ids(db_session, vendor_id, today=AFTER_RULE + timedelta(days=1)) == []


async def test_a_photographer_needs_no_cover_to_be_listed(db_session: AsyncSession) -> None:
    """Services outside the required list (DJ here) are never hidden for insurance."""
    vendor_id = await new_vendor(
        db_session, "ins-photo@example.com", services=["photography", "dj"], certificate=""
    )
    assert await listed_ids(db_session, vendor_id, today=AFTER_RULE) == [vendor_id]


async def test_approving_a_caterer_needs_checked_cover_first(db_session: AsyncSession) -> None:
    """Approval is refused until staff check the certificate, then goes through."""
    vendor_id = await new_vendor(
        db_session, "ins-approve@example.com", services=["catering"], approval_status="pending"
    )
    staff_member = await new_staff(db_session, "ins-approve-staff@example.com")
    with pytest.raises(InsuranceRequiredForApproval):
        await service_moderation.set_approval(
            db_session, staff_member, vendor_id, "approved", mailer=FakeMailer()
        )
    expires_on = datetime.now(UTC).date() + timedelta(days=365)
    await service_moderation.verify_insurance(
        db_session, staff_member, vendor_id, expires_on=expires_on, cover_gbp=2_000_000
    )
    approved = await service_moderation.set_approval(
        db_session, staff_member, vendor_id, "approved", mailer=FakeMailer()
    )
    assert approved.approval_status == "approved"


async def test_checking_and_withdrawing_a_certificate(db_session: AsyncSession) -> None:
    """A check stores the expiry and cover against the uploaded file; withdrawing clears them."""
    vendor_id = await new_vendor(db_session, "ins-verify@example.com", services=["catering"])
    staff_member = await new_staff(db_session, "ins-verify-staff@example.com")
    expires_on = datetime.now(UTC).date() + timedelta(days=200)
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


async def test_a_check_is_refused_without_a_file_with_low_cover_or_an_ended_date(
    db_session: AsyncSession,
) -> None:
    """Each bad check names its own reason."""
    staff_member = await new_staff(db_session, "ins-refuse-staff@example.com")
    future = datetime.now(UTC).date() + timedelta(days=100)
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
            expires_on=datetime.now(UTC).date() - timedelta(days=1),
            cover_gbp=1_000_000,
        )


async def test_the_reminder_goes_once_per_checked_certificate(db_session: AsyncSession) -> None:
    """Cover ending within 30 days earns one email; a new check starts the next cycle."""
    today = datetime.now(UTC).date()
    vendor_id = await new_vendor(
        db_session,
        "ins-remind@example.com",
        services=["baking"],
        insurance_expires_on=today + timedelta(days=10),
    )
    now = datetime.now(UTC)
    mailer = FakeMailer()
    await service_reminders.send_insurance_reminders(db_session, mailer, now=now)
    await service_reminders.send_insurance_reminders(db_session, mailer, now=now)
    sent: list[OutgoingEmail] = [email for email in mailer.sent if "ins-remind@example.com" in email.to]
    assert len(sent) == 1

    candidates = await vendor_repository.insurance_reminder_candidates(db_session, today=today, limit=500)
    assert vendor_id not in [vendor.user_id for vendor in candidates]
    staff_member = await new_staff(db_session, "ins-remind-staff@example.com")
    await service_moderation.verify_insurance(
        db_session, staff_member, vendor_id, expires_on=today + timedelta(days=20), cover_gbp=1_000_000
    )
    candidates = await vendor_repository.insurance_reminder_candidates(db_session, today=today, limit=500)
    assert vendor_id in [vendor.user_id for vendor in candidates]
