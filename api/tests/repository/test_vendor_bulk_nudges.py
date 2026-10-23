"""Admin bulk reminder emails never reach a suspended vendor or a closed account."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository_deletion
from app.features.vendors import repository as vendor_repository
from app.features.vendors import service_moderation
from tests.repository.test_booking_writes import new_user
from tests.repository.test_vendor_insurance import new_staff
from tests.support.fakes import FakeMailer

pytestmark = pytest.mark.db


async def _draft_vendor(session: AsyncSession, email: str, **columns: object) -> str:
    """An unfinished draft vendor with an email on file."""
    vendor_id = await new_user(session, email, "vendor")
    saved = await vendor_repository.save_profile(
        session,
        vendor_id,
        {"status": "draft", "payload": {"businessName": f"Nudge {email}"}, **columns},
        exists=False,
    )
    assert saved
    return vendor_id


async def test_profile_reminder_skips_a_suspended_vendor_and_a_closed_account(
    db_session: AsyncSession,
) -> None:
    """Both are counted as skipped and no email leaves; an active draft is still emailed."""
    staff = await new_staff(db_session, "nudge-staff@example.com")
    active = await _draft_vendor(db_session, "nudge-active@example.com")
    banned = await _draft_vendor(db_session, "nudge-banned@example.com", approval_status="banned")
    closed = await _draft_vendor(db_session, "nudge-closed@example.com")
    await repository_deletion.tombstone_user(db_session, closed, now=datetime.now(UTC))
    mailer = FakeMailer()

    result = await service_moderation.nudge_to_complete_profile(
        db_session, staff, [banned, closed], mailer=mailer
    )
    assert (result.sent, result.skipped, result.failures) == (0, 2, [])
    assert mailer.sent == []

    result = await service_moderation.nudge_to_complete_profile(db_session, staff, [active], mailer=mailer)
    assert (result.sent, result.skipped) == (1, 0)
    assert [email.to for email in mailer.sent] == [("nudge-active@example.com",)]
