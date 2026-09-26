"""Writes that can hit a unique index answer "taken" and leave the request's transaction usable.

A failed statement aborts the whole Postgres transaction, so each of these
writes runs in a savepoint. Every test makes one more query after the clash:
without the savepoint that query fails with "current transaction is aborted".
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository as identity_repository
from app.features.referrals import repository as referrals_repository
from app.features.vendors import repository as vendors_repository

pytestmark = pytest.mark.db


async def new_user(session: AsyncSession, email: str, user_type: str = "vendor") -> str:
    """A `users` row to hang vendor and referral rows off."""
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


async def test_a_second_vendor_cannot_take_a_business_name(db_session: AsyncSession) -> None:
    """The normalised name is computed by Postgres, so case and spacing do not dodge the index."""
    first_vendor = await new_user(db_session, "first@example.com")
    second_vendor = await new_user(db_session, "second@example.com")
    assert await vendors_repository.save_profile(
        db_session, first_vendor, {"payload": {"businessName": "Sunny  Sounds"}}, exists=False
    )

    assert not await vendors_repository.save_profile(
        db_session, second_vendor, {"payload": {"businessName": "sunny sounds"}}, exists=False
    )
    assert (
        await vendors_repository.business_name_owner(
            db_session, "sunny sounds", exclude_user_id=second_vendor
        )
        == first_vendor
    )
    assert await vendors_repository.get_vendor(db_session, second_vendor) is None


async def test_a_vendor_row_reads_back_in_the_baseline_shape(db_session: AsyncSession) -> None:
    """Text ids and ISO timestamps in UTC, as PostgREST returned them."""
    vendor_user = await new_user(db_session, "shape@example.com")
    await vendors_repository.save_profile(
        db_session, vendor_user, {"payload": {"businessName": "Shape Co"}}, exists=False
    )
    vendor = await vendors_repository.get_vendor(db_session, vendor_user)
    assert vendor is not None
    assert (vendor.user_id, vendor.status, vendor.approval_status, vendor.payload) == (
        vendor_user,
        "draft",
        "pending",
        {"businessName": "Shape Co"},
    )
    assert vendor.created_at is not None and vendor.created_at.endswith("+00:00")


async def test_a_taken_partner_slug_answers_none(db_session: AsyncSession) -> None:
    values = {"slug": "sam-creates", "display_name": "Sam", "is_active": True}
    stored = await referrals_repository.insert_partner(db_session, values)
    assert stored is not None and stored.slug == "sam-creates"

    assert await referrals_repository.insert_partner(db_session, {**values, "display_name": "Other"}) is None
    assert await referrals_repository.slugs_starting_with(db_session, "sam-creates") == {"sam-creates"}


async def test_the_first_attribution_wins(db_session: AsyncSession) -> None:
    vendor_user = await new_user(db_session, "attributed@example.com")
    partner = await referrals_repository.insert_partner(
        db_session, {"slug": "first-touch", "display_name": "First", "is_active": True}
    )
    assert partner is not None
    attribution = {"user_id": vendor_user, "referral_partner_id": partner.id, "referral_slug": "first-touch"}

    assert await referrals_repository.insert_attribution(db_session, attribution) is True
    assert await referrals_repository.insert_attribution(db_session, attribution) is False
    stored = await referrals_repository.find_attribution(db_session, vendor_user)
    assert stored is not None and stored.referral_partner_id == partner.id


async def test_a_client_code_belongs_to_one_vendor(db_session: AsyncSession) -> None:
    first_vendor = await new_user(db_session, "code-one@example.com")
    second_vendor = await new_user(db_session, "code-two@example.com")
    for vendor_user, name in ((first_vendor, "Code One"), (second_vendor, "Code Two")):
        await vendors_repository.save_profile(
            db_session, vendor_user, {"payload": {"businessName": name}}, exists=False
        )

    assert await referrals_repository.save_vendor_code(db_session, first_vendor, "123456") is True
    assert await referrals_repository.save_vendor_code(db_session, second_vendor, "123456") is False
    assert (
        await referrals_repository.code_taken_by_another_vendor(db_session, "123456", second_vendor) is True
    )


async def test_a_second_account_with_the_same_email_answers_none(db_session: AsyncSession) -> None:
    await new_user(db_session, "twice@example.com", user_type="client")
    duplicate = await identity_repository.create_account(
        db_session,
        email="twice@example.com",
        user_type="client",
        admin_role=None,
        email_verified_at=None,
        account_suspended=False,
    )
    assert duplicate is None
    assert await identity_repository.find_profile_by_email(db_session, "twice@example.com") is not None
