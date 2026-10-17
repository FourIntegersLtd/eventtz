"""Identity use cases other slices call: naming users, finding them by email, changing their account type."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.features.identity import repository
from app.features.identity.domain import client_display_name
from app.features.identity.errors import TermsNotAccepted as TermsNotAccepted
from app.features.identity.errors import TermsVersionMismatch
from app.features.identity.rows import UserSummaryRow
from app.features.identity.schemas import AcceptTermsResponse


async def client_display_names(session: AsyncSession, user_ids: list[str]) -> dict[str, str]:
    """Map each existing user id to the name a vendor sees for that client. Unknown ids are left out."""
    return {
        user.id: client_display_name(
            email=user.email, preferred_name=user.preferred_name, deleted=bool(user.deleted_at)
        )
        for user in await repository.list_user_summaries(session, user_ids)
    }


async def emails_by_id(session: AsyncSession, user_ids: list[str]) -> dict[str, str | None]:
    """Map each existing user id to their email (for staff screens). Unknown ids are left out."""
    return {user.id: user.email for user in await repository.list_user_summaries(session, user_ids)}


async def contact_emails(session: AsyncSession, user_ids: list[str]) -> dict[str, str | None]:
    """Map each existing user id to the email the other side of a booking may see; `None` once closed."""
    return {
        user.id: None if user.deleted_at else user.email
        for user in await repository.list_user_summaries(session, user_ids)
    }


async def email_labels(session: AsyncSession, user_ids: list[str]) -> dict[str, str]:
    """Map each existing user id to the email staff screens show for them.

    Baseline labels: a closed account shows "" and an account with no email
    shows "Client". Unknown ids are left out.
    """
    return {
        user.id: "" if user.deleted_at else ((user.email or "").strip() or "Client")
        for user in await repository.list_user_summaries(session, user_ids)
    }


async def user_types(session: AsyncSession, user_ids: list[str]) -> dict[str, str]:
    """Map each existing user id to its account type (client, vendor or admin). Unknown ids are left out."""
    return {
        user.id: user.user_type
        for user in await repository.list_user_summaries(session, user_ids)
        if user.user_type
    }


async def open_user_ids_of_type(
    session: AsyncSession, user_type: str, *, include_suspended: bool
) -> list[str]:
    """Every open account of `user_type` (closed ones are tombstones), for broadcasts and staff fan-out."""
    return await repository.open_user_ids_of_type(
        session, user_type=user_type, include_suspended=include_suspended
    )


async def vendor_ids_with_email_like(session: AsyncSession, pattern: str, *, limit: int) -> list[str]:
    """Vendor accounts whose email matches the ILIKE `pattern` (staff search), at most `limit`."""
    return await repository.user_ids_of_type_with_email_like(
        session, user_type="vendor", pattern=pattern, limit=limit
    )


async def mark_as_vendor(session: AsyncSession, user_id: str) -> None:
    """Make the account a vendor account, as saving a vendor profile does.

    Baseline behaviour: this applies to any caller, so a client (or staff member)
    who saves a vendor profile becomes a vendor. Closed accounts stay tombstones.
    """
    profile = await repository.get_profile(session, user_id)
    if profile is None or profile.deleted_at:
        return
    await repository.update_profile(session, user_id, {"user_type": "vendor"})


async def has_accepted_current_terms(session: AsyncSession, user_id: str) -> bool:
    """True when the account's accepted Terms version is the current `terms_version` setting."""
    profile = await repository.get_profile(session, user_id)
    return profile is not None and profile.terms_accepted_version == get_settings().terms_version


async def require_current_terms(session: AsyncSession, user_id: str) -> None:
    """Raise `TermsNotAccepted` unless the account has accepted the current Terms."""
    if not await has_accepted_current_terms(session, user_id):
        raise TermsNotAccepted()


async def accept_terms(session: AsyncSession, user_id: str, version: str) -> AcceptTermsResponse:
    """Record acceptance of `version`; `TermsVersionMismatch` when it is not the current version."""
    current_version = get_settings().terms_version
    if version != current_version:
        raise TermsVersionMismatch()
    await repository.stamp_terms_accepted(session, user_id, version)
    profile = await repository.get_profile(session, user_id)
    return AcceptTermsResponse(
        terms_version=current_version,
        terms_accepted_version=profile.terms_accepted_version if profile else None,
        terms_accepted_at=profile.terms_accepted_at if profile else None,
    )


async def users_awaiting_terms_notice(
    session: AsyncSession, version: str, *, limit: int
) -> list[UserSummaryRow]:
    """Open, unsuspended accounts not yet emailed about Terms `version` (at most `limit`)."""
    return await repository.users_awaiting_terms_notice(session, version, limit=limit)


async def mark_terms_notice_sent(session: AsyncSession, user_ids: list[str], version: str) -> None:
    """Record that these accounts were emailed about Terms `version`."""
    await repository.mark_terms_notice_sent(session, user_ids, version)
