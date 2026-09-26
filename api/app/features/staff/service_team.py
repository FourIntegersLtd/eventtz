"""Use cases behind `/admin/team*`: list, invite, patch, delete, send a reset link.

Mirrors `backend/app/features/admin/team_admin_commands.py`. Two simplifications
the rebuild's different account architecture allows (see the identity slice's
`service_staff_accounts.py` module docstring):

- An invited admin with no password is created with no password hash at all,
  and a one-click setup link, rather than a throwaway Supabase password.
- Only one invite/welcome email is sent (`notifications.send_welcome`), not the
  baseline's separate "team invite" and "welcome" emails.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import Mailer
from app.features.identity import service_staff_accounts as accounts
from app.features.notifications import service as notifications
from app.features.staff import repository
from app.features.staff.errors import (
    AdminUserNotFound,
    CannotDeleteLastSuperAdmin,
    CannotDeleteSelf,
    CannotDemoteLastSuperAdmin,
    CannotDemoteSelf,
    CannotSuspendSelf,
    InvalidEmailAddress,
)
from app.features.staff.rows import AdminTeamMemberRow
from app.features.staff.schemas import (
    AdminTeamDeleteResponse,
    AdminTeamInviteResponse,
    AdminTeamListResponse,
    AdminTeamMember,
    AdminTeamPatchBody,
    AdminTeamSendResetLinkResponse,
)

# These are user-facing status messages, not secrets; ruff's hardcoded-password
# check fires on the word "password" in the name, so it is silenced per line.
ADMIN_CREATED = "Admin account created."
ADMIN_CREATED_PASSWORD_LINK = "Admin account created. We sent a link to set their password."  # noqa: S105
PROMOTED_TO_ADMIN = "Existing account promoted to admin."
PROMOTED_ADMIN_PASSWORD_LINK = "Existing account promoted to admin. We sent a link to set their password."  # noqa: S105
ADMIN_ALREADY_PASSWORD_UPDATED = "This person is already an admin. Password updated."  # noqa: S105
PASSWORD_SETUP_LINK_SENT = "This person is already an admin. We sent a link to set their password."  # noqa: S105
PASSWORD_RESET_LINK_SENT = "Password reset link sent."  # noqa: S105
ADMIN_REMOVED_REMAINS_VENDOR = "Admin access removed. The account remains active as a vendor."
ADMIN_REMOVED_REMAINS_CLIENT = "Admin access removed. The account remains active as a client."
ADMIN_ACCOUNT_DELETED = "Admin account deleted."


def _looks_like_email(value: str) -> bool:
    """The same loose check the baseline uses: trimmed, lower-cased, and containing an `@`."""
    return bool(value.strip()) and "@" in value


def _member(row: AdminTeamMemberRow) -> AdminTeamMember:
    """A repository row, as the API answers it."""
    role: Literal["super_admin", "admin"] = "super_admin" if row.admin_role == "super_admin" else "admin"
    return AdminTeamMember(
        user_id=row.id,
        email=row.email,
        admin_role=role,
        created_at=row.created_at,
        account_suspended=row.account_suspended,
    )


async def list_team(session: AsyncSession) -> AdminTeamListResponse:
    """Every admin account, for the team roster screen."""
    members = [_member(row) for row in await repository.list_admin_team(session)]
    return AdminTeamListResponse(members=members)


async def invite(
    session: AsyncSession, mailer: Mailer, *, email: str, password: str | None
) -> AdminTeamInviteResponse:
    """Create, promote, or top up the password of an admin account, by email."""
    normalised = email.strip().lower()
    if not _looks_like_email(normalised):
        raise InvalidEmailAddress()
    use_invite_link = not (password or "").strip()

    existing = await accounts.find_admin_account_by_email(session, normalised)
    if existing is not None and existing.user_type == "admin":
        user_id = existing.id
        if use_invite_link:
            await accounts.send_admin_setup_link(session, mailer, email=normalised, user_id=user_id)
            message = PASSWORD_SETUP_LINK_SENT
        else:
            await accounts.set_account_password(session, user_id, password or "")
            message = ADMIN_ALREADY_PASSWORD_UPDATED
        existing_role: Literal["super_admin", "admin"] = (
            "super_admin" if existing.admin_role == "super_admin" else "admin"
        )
        return AdminTeamInviteResponse(
            user_id=user_id,
            email=normalised,
            admin_role=existing_role,
            created=False,
            invite_link_sent=use_invite_link,
            message=message,
        )

    if existing is not None:
        user_id = existing.id
        await accounts.promote_to_admin(session, user_id, password=None if use_invite_link else password)
        if use_invite_link:
            await accounts.send_admin_setup_link(session, mailer, email=normalised, user_id=user_id)
            message = PROMOTED_ADMIN_PASSWORD_LINK
        else:
            notifications.send_welcome(mailer, email=normalised, user_type="admin")
            message = PROMOTED_TO_ADMIN
        return AdminTeamInviteResponse(
            user_id=user_id,
            email=normalised,
            admin_role="admin",
            created=False,
            invite_link_sent=use_invite_link,
            message=message,
        )

    new_user_id = await accounts.create_admin_account(
        session, email=normalised, password=None if use_invite_link else password
    )
    if new_user_id is None:  # a race with another request that just took this email
        raise InvalidEmailAddress()
    user_id = new_user_id
    if use_invite_link:
        await accounts.send_admin_setup_link(session, mailer, email=normalised, user_id=user_id)
        message = ADMIN_CREATED_PASSWORD_LINK
    else:
        notifications.send_welcome(mailer, email=normalised, user_type="admin")
        message = ADMIN_CREATED
    return AdminTeamInviteResponse(
        user_id=user_id,
        email=normalised,
        admin_role="admin",
        created=True,
        invite_link_sent=use_invite_link,
        message=message,
    )


async def send_reset_link(
    session: AsyncSession, mailer: Mailer, user_id: str
) -> AdminTeamSendResetLinkResponse:
    """Email an existing admin a fresh password-reset link."""
    member = await repository.find_admin_by_id(session, user_id)
    if member is None:
        raise AdminUserNotFound()
    email = (member.email or "").strip().lower()
    if not email:
        raise AdminUserNotFound()
    await accounts.send_admin_reset_link(session, mailer, email=email, user_id=member.id)
    return AdminTeamSendResetLinkResponse(user_id=member.id, email=email, message=PASSWORD_RESET_LINK_SENT)


async def patch_member(
    session: AsyncSession, principal: Principal, user_id: str, body: AdminTeamPatchBody
) -> AdminTeamMember:
    """Change an admin's role and/or suspension flag."""
    member = await repository.find_admin_by_id(session, user_id)
    if member is None:
        raise AdminUserNotFound()

    if user_id == principal.id:
        if body.admin_role is not None and body.admin_role != "super_admin":
            raise CannotDemoteSelf()
        if body.account_suspended is True:
            raise CannotSuspendSelf()

    changes: dict[str, object] = {}
    if body.admin_role is not None:
        demotes_a_super_admin = body.admin_role == "admin" and member.admin_role == "super_admin"
        if (
            demotes_a_super_admin
            and await repository.count_other_super_admins(session, excluding_user_id=user_id) == 0
        ):
            raise CannotDemoteLastSuperAdmin()
        changes["admin_role"] = body.admin_role
    if body.account_suspended is not None:
        changes["account_suspended"] = body.account_suspended

    updated = await repository.patch_admin(session, user_id, changes)
    if updated is None:
        raise AdminUserNotFound()
    return _member(updated)


async def delete_member(session: AsyncSession, principal: Principal, user_id: str) -> AdminTeamDeleteResponse:
    """Remove an admin from the team: hard-deleted if nothing else references the account,
    otherwise demoted to whichever role (vendor, then client) its other rows require."""
    if user_id == principal.id:
        raise CannotDeleteSelf()
    member = await repository.find_admin_by_id(session, user_id)
    if member is None:
        raise AdminUserNotFound()

    is_last_super_admin = (
        member.admin_role == "super_admin"
        and await repository.count_other_super_admins(session, excluding_user_id=user_id) == 0
    )
    if is_last_super_admin:
        raise CannotDeleteLastSuperAdmin()

    email = member.email

    if await repository.has_vendor_profile(session, user_id):
        await repository.demote_admin(session, user_id, user_type="vendor")
        return AdminTeamDeleteResponse(
            user_id=user_id,
            email=email,
            deleted=False,
            demoted_to="vendor",
            message=ADMIN_REMOVED_REMAINS_VENDOR,
        )

    if await repository.has_client_or_restricted_activity(session, user_id):
        await repository.demote_admin(session, user_id, user_type="client")
        return AdminTeamDeleteResponse(
            user_id=user_id,
            email=email,
            deleted=False,
            demoted_to="client",
            message=ADMIN_REMOVED_REMAINS_CLIENT,
        )

    await repository.hard_delete_user(session, user_id)
    return AdminTeamDeleteResponse(
        user_id=user_id, email=email, deleted=True, demoted_to=None, message=ADMIN_ACCOUNT_DELETED
    )
