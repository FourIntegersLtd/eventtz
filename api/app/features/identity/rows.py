"""Typed rows the identity repositories return. Only repositories build them; schemas never import them.

Plain values (text ids, ISO timestamps): the shape the domain rules and goldens
were written against. The sign-in rows added with platform tokens carry real
datetimes, because only new code reads them. The mapped tables are in `models.py`.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserSummaryRow(BaseModel):
    """The few `users` columns other slices need to name someone."""

    id: str
    email: str | None = None
    preferred_name: str | None = None
    deleted_at: str | None = None


class UserProfileRow(BaseModel):
    """An account's `users` row: type, staff role, status flags and client onboarding."""

    id: str
    email: str | None = None
    user_type: str | None = None
    admin_role: str | None = None
    account_suspended: bool | None = False
    email_verified_at: str | None = None
    deleted_at: str | None = None
    preferred_name: str | None = None
    client_onboarding_completed_at: str | None = None


class ContactSettingsRow(BaseModel):
    """What a user lets the other side of a paid booking see. `None` columns mean "share"."""

    contact_phone: str | None = None
    share_email: bool | None = True
    share_phone: bool | None = True
    share_address: bool | None = True


class OneClickTokenRow(BaseModel):
    """A stored verify-email or reset-password token (the raw token is only ever in the email)."""

    id: str
    user_id: str
    expires_at: str | None = None
    used_at: str | None = None


class CredentialsRow(BaseModel):
    """What sign-in checks a password against. Kept apart from `UserProfileRow` so a hash
    never travels further than the password check."""

    id: str
    password_hash: str | None = None


class RefreshChainRow(BaseModel):
    """One sign-in, from which a series of refresh tokens is issued."""

    id: str
    user_id: str
    expires_at: datetime
    revoked_at: datetime | None = None


class RefreshTokenRow(BaseModel):
    """One issued refresh token; `used_at` is set once it has been exchanged."""

    id: str
    chain_id: str
    used_at: datetime | None = None
