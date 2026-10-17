"""Database access for accounts: `users` rows, the one-click email tokens and sign-in sessions.

The only file in this slice that builds SQL or imports `models`. Every function
takes the request's session and never commits (ADR 0002); it answers with the
plain rows in `rows.py`, so services and domain rules never see mapped objects.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_value
from app.features.identity.models import (
    EmailVerificationToken,
    PasswordResetToken,
    RefreshChain,
    RefreshToken,
    User,
)
from app.features.identity.rows import (
    ContactSettingsRow,
    CredentialsRow,
    OneClickTokenRow,
    RefreshChainRow,
    RefreshTokenRow,
    UserProfileRow,
    UserSummaryRow,
)

# The two token tables share one shape: (user_id, token_hash, expires_at, used_at).
TokenTable = Literal["email_verification_tokens", "password_reset_tokens"]
_TOKEN_MODELS: dict[TokenTable, type[EmailVerificationToken] | type[PasswordResetToken]] = {
    "email_verification_tokens": EmailVerificationToken,
    "password_reset_tokens": PasswordResetToken,
}


def _profile_row(user: User) -> UserProfileRow:
    """A mapped account as the plain profile row services read."""
    return UserProfileRow(
        id=str(user.id),
        email=user.email,
        user_type=user.user_type,
        admin_role=user.admin_role,
        account_suspended=user.account_suspended,
        email_verified_at=plain_value(user.email_verified_at),
        deleted_at=plain_value(user.deleted_at),
        preferred_name=user.preferred_name,
        client_onboarding_completed_at=plain_value(user.client_onboarding_completed_at),
        terms_accepted_version=user.terms_accepted_version,
        terms_accepted_at=plain_value(user.terms_accepted_at),
    )


# --- users -----------------------------------------------------------------------------------------


async def list_user_summaries(session: AsyncSession, user_ids: list[str]) -> list[UserSummaryRow]:
    """The named users that exist (unknown ids are simply absent), in one query."""
    unique_ids = {as_uuid(user_id.strip()) for user_id in user_ids if user_id and user_id.strip()}
    known_ids = sorted(user_id for user_id in unique_ids if user_id is not None)
    if not known_ids:
        return []
    statement = select(User.id, User.email, User.preferred_name, User.deleted_at, User.user_type).where(
        User.id.in_(known_ids)
    )
    return [
        UserSummaryRow(
            id=str(summary.id),
            email=summary.email,
            preferred_name=summary.preferred_name,
            deleted_at=plain_value(summary.deleted_at),
            user_type=summary.user_type,
        )
        for summary in (await session.execute(statement)).all()
    ]


async def get_profile(session: AsyncSession, user_id: str) -> UserProfileRow | None:
    """The account's `users` row, or `None` when it has none."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return None
    user = await session.get(User, account_id)
    return _profile_row(user) if user is not None else None


async def find_profile_by_email(session: AsyncSession, email: str) -> UserProfileRow | None:
    """The `users` row with this (already normalised) email, or `None`."""
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    return _profile_row(user) if user is not None else None


async def find_credentials_by_email(session: AsyncSession, email: str) -> CredentialsRow | None:
    """The id and password hash for this (already normalised) email, or `None`."""
    statement = select(User.id, User.password_hash).where(User.email == email)
    found = (await session.execute(statement)).one_or_none()
    return CredentialsRow(id=str(found.id), password_hash=found.password_hash) if found is not None else None


async def get_credentials(session: AsyncSession, user_id: str) -> CredentialsRow | None:
    """The id and password hash of this account, or `None`."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return None
    password_hash = (
        await session.execute(select(User.password_hash).where(User.id == account_id))
    ).one_or_none()
    return CredentialsRow(id=user_id, password_hash=password_hash[0]) if password_hash is not None else None


async def create_account(
    session: AsyncSession,
    *,
    email: str,
    user_type: str,
    password_hash: str | None = None,
    admin_role: str | None = None,
    email_verified_at: datetime | None = None,
    account_suspended: bool = False,
    terms_accepted_version: str | None = None,
    terms_accepted_at: datetime | None = None,
) -> str | None:
    """Insert a `users` row and return its new id; `None` when the email is already taken.

    Sign-up passes only the first three; tests also set the role and status
    flags to reach every state an account can be in. The insert runs in a
    savepoint so a duplicate email leaves the request's transaction usable.
    """
    account = User(
        email=email,
        user_type=user_type,
        password_hash=password_hash,
        admin_role=admin_role,
        email_verified_at=email_verified_at,
        account_suspended=account_suspended,
        terms_accepted_version=terms_accepted_version,
        terms_accepted_at=terms_accepted_at,
    )
    try:
        async with session.begin_nested():
            session.add(account)
    except IntegrityError:
        return None
    return str(account.id)


async def update_profile(session: AsyncSession, user_id: str, changes: dict[str, Any]) -> None:
    """Apply `changes` (column → value) to the account's `users` row.

    Timestamps may arrive as ISO text from the domain rules; Postgres casts them.
    """
    account_id = as_uuid(user_id)
    if account_id is None or not changes:
        return
    await session.execute(update(User).where(User.id == account_id).values(**changes))


async def user_ids_of_type_with_email_like(
    session: AsyncSession, *, user_type: str, pattern: str, limit: int
) -> list[str]:
    """Accounts of `user_type` whose email matches the ILIKE `pattern`, at most `limit` of them."""
    result = await session.scalars(
        select(User.id).where(User.user_type == user_type, User.email.ilike(pattern)).limit(limit)
    )
    return [str(user_id) for user_id in result]


async def open_user_ids_of_type(
    session: AsyncSession, *, user_type: str, include_suspended: bool
) -> list[str]:
    """Every open (not closed) account of `user_type`, optionally leaving out suspended ones."""
    statement = select(User.id).where(User.user_type == user_type, User.deleted_at.is_(None))
    if not include_suspended:
        statement = statement.where(User.account_suspended.is_(False))
    return [str(user_id) for user_id in await session.scalars(statement.order_by(User.id))]


async def stamp_terms_accepted(session: AsyncSession, user_id: str, version: str) -> None:
    """Record that the account accepted Terms `version`, stamped with the database clock."""
    await update_profile(
        session, user_id, {"terms_accepted_version": version, "terms_accepted_at": func.now()}
    )


async def set_password_hash(session: AsyncSession, user_id: str, password_hash: str) -> None:
    """Store a new password hash for this account."""
    await update_profile(session, user_id, {"password_hash": password_hash})


async def get_contact_settings(session: AsyncSession, user_id: str) -> ContactSettingsRow | None:
    """The account's contact-sharing columns, or `None` when it has no `users` row."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return None
    statement = select(User.contact_phone, User.share_email, User.share_phone, User.share_address).where(
        User.id == account_id
    )
    found = (await session.execute(statement)).one_or_none()
    if found is None:
        return None
    return ContactSettingsRow(
        contact_phone=found.contact_phone,
        share_email=found.share_email,
        share_phone=found.share_phone,
        share_address=found.share_address,
    )


# --- one-click tokens --------------------------------------------------------------------------------


async def invalidate_unused_tokens(
    session: AsyncSession, table: TokenTable, *, user_id: str, now: datetime
) -> None:
    """Mark every unused token of this user as used, so only the newest link works."""
    token_model = _TOKEN_MODELS[table]
    await session.execute(
        update(token_model)
        .where(token_model.user_id == uuid.UUID(user_id), token_model.used_at.is_(None))
        .values(used_at=now)
    )


async def insert_token(
    session: AsyncSession, table: TokenTable, *, user_id: str, token_hash: str, expires_at: datetime
) -> None:
    """Store a new token's hash and expiry."""
    session.add(
        _TOKEN_MODELS[table](user_id=uuid.UUID(user_id), token_hash=token_hash, expires_at=expires_at)
    )
    await session.flush()


async def find_token(session: AsyncSession, table: TokenTable, token_hash: str) -> OneClickTokenRow | None:
    """The stored token with this hash, used or not, or `None`."""
    token_model = _TOKEN_MODELS[table]
    statement = select(
        token_model.id, token_model.user_id, token_model.expires_at, token_model.used_at
    ).where(token_model.token_hash == token_hash)
    found = (await session.execute(statement)).one_or_none()
    if found is None:
        return None
    return OneClickTokenRow(
        id=str(found.id),
        user_id=str(found.user_id),
        expires_at=plain_value(found.expires_at),
        used_at=plain_value(found.used_at),
    )


async def mark_token_used(session: AsyncSession, table: TokenTable, *, token_id: str, now: datetime) -> None:
    """Record that this token's link has been used."""
    token_model = _TOKEN_MODELS[table]
    await session.execute(
        update(token_model).where(token_model.id == uuid.UUID(token_id)).values(used_at=now)
    )


# --- sign-in sessions (refresh chains, copied from OSCE) ---------------------------------------------


async def create_refresh_chain(
    session: AsyncSession, *, user_id: str, token_hash: str, expires_at: datetime
) -> None:
    """Start a new sign-in: a chain and its first token, ready to rotate."""
    chain = RefreshChain(user_id=uuid.UUID(user_id), expires_at=expires_at)
    session.add(chain)
    await session.flush()
    session.add(RefreshToken(chain_id=chain.id, token_hash=token_hash))
    await session.flush()


async def refresh_token_by_hash(session: AsyncSession, token_hash: str) -> RefreshTokenRow | None:
    """The issued token this hash matches, spent or not, or `None` for one never minted."""
    statement = select(RefreshToken.id, RefreshToken.chain_id, RefreshToken.used_at).where(
        RefreshToken.token_hash == token_hash
    )
    found = (await session.execute(statement)).one_or_none()
    if found is None:
        return None
    return RefreshTokenRow(id=str(found.id), chain_id=str(found.chain_id), used_at=found.used_at)


async def refresh_chain_by_id(session: AsyncSession, chain_id: str) -> RefreshChainRow | None:
    """The sign-in a refresh token's chain id names, or `None` if it is gone."""
    chain = await session.get(RefreshChain, uuid.UUID(chain_id))
    if chain is None:
        return None
    return RefreshChainRow(
        id=str(chain.id), user_id=str(chain.user_id), expires_at=chain.expires_at, revoked_at=chain.revoked_at
    )


async def spend_and_issue(
    session: AsyncSession, *, token_id: str, chain_id: str, token_hash: str, at: datetime
) -> bool:
    """Mark the presented token spent and add its successor. False when it was already spent.

    The spend is conditional (`used_at IS NULL`), so of two requests racing
    with one token only the first gets a successor; OSCE's unconditional
    update would hand both a live token.
    """
    spent = await session.execute(
        update(RefreshToken)
        .where(RefreshToken.id == uuid.UUID(token_id), RefreshToken.used_at.is_(None))
        .values(used_at=at)
    )
    if spent.rowcount != 1:  # type: ignore[attr-defined]
        return False
    session.add(RefreshToken(chain_id=uuid.UUID(chain_id), token_hash=token_hash))
    await session.flush()
    return True


async def revoke_refresh_chain(session: AsyncSession, *, chain_id: str, at: datetime, reason: str) -> None:
    """End one sign-in: every refresh token issued from this chain stops working."""
    await session.execute(
        update(RefreshChain)
        .where(RefreshChain.id == uuid.UUID(chain_id))
        .values(revoked_at=at, revoked_reason=reason)
    )


async def revoke_all_chains_for_user(
    session: AsyncSession, *, user_id: str, at: datetime, reason: str
) -> None:
    """End every sign-in this account still has open (sign-out everywhere, password change or reset)."""
    await session.execute(
        update(RefreshChain)
        .where(RefreshChain.user_id == uuid.UUID(user_id), RefreshChain.revoked_at.is_(None))
        .values(revoked_at=at, revoked_reason=reason)
    )
