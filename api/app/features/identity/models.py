"""Typed rows the identity repositories return. Only repositories build them; schemas never import them."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


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


class AuthIdentity(BaseModel):
    """A Supabase Auth user: who they are, before our `users` row is merged in."""

    id: str
    email: str | None = None
    user_metadata: dict[str, Any] = Field(default_factory=dict)
    app_metadata: dict[str, Any] = Field(default_factory=dict)


class AuthTokens(BaseModel):
    """A Supabase session: the tokens stored in the session cookies."""

    access_token: str
    refresh_token: str
    expires_at: int | None = None


class AuthenticatedSession(BaseModel):
    """A successful sign-in or refresh."""

    identity: AuthIdentity
    tokens: AuthTokens


# Why Supabase Auth said no. `unavailable` means it did not answer at all.
AuthRefusal = Literal["email_taken", "wrong_credentials", "email_not_confirmed", "refused", "unavailable"]
