"""Request and response bodies for the account routes (`/auth`, `/user`, `/client/onboarding`).

Names and fields match the baseline contracts, so the generated web types do not change.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# --- the signed-in account ---------------------------------------------------------------------------


class AuthUser(BaseModel):
    """The account as the web app sees it: Supabase identity merged with the `users` row.

    `preferred_name` and `client_onboarding_completed` are only filled for clients.
    """

    id: str
    email: str | None = None
    user_type: str = "client"
    admin_role: str | None = None
    account_suspended: bool = False
    email_verified: bool | None = None
    preferred_name: str | None = None
    client_onboarding_completed: bool | None = None
    user_metadata: dict[str, Any] = Field(default_factory=dict)
    app_metadata: dict[str, Any] = Field(default_factory=dict)


class AuthSession(BaseModel):
    """The Supabase session tokens (also set as httpOnly cookies)."""

    access_token: str
    refresh_token: str
    expires_at: int | None = None


class MeResponse(BaseModel):
    """`GET /auth/me`."""

    success: bool = True
    user: AuthUser


# --- sign-up, sign-in, sessions ------------------------------------------------------------------------


class SignupRequest(BaseModel):
    """A new client or vendor account. `referral_code` is a creator's `?ref=` slug (vendors only)."""

    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    user_type: Literal["client", "vendor"] = "client"
    referral_code: str | None = None


class SignupResponse(BaseModel):
    """The new account. `session` is always empty: the user must verify their email, then sign in."""

    success: bool = True
    user: AuthUser
    session: AuthSession | None = None
    message: str | None = None


class SignInRequest(BaseModel):
    """Email and password."""

    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class SignInResponse(BaseModel):
    """The signed-in account and its session."""

    success: bool = True
    user: AuthUser
    session: AuthSession


class SignOutResponse(BaseModel):
    """Always a success: the cookies are cleared either way."""

    success: bool = True


class RefreshSessionRequest(BaseModel):
    """A refresh token; leave it out to use the refresh cookie."""

    refresh_token: str | None = Field(default=None)


class RefreshSessionResponse(BaseModel):
    """The account and its new session."""

    success: bool = True
    user: AuthUser
    session: AuthSession


# --- email links and passwords ------------------------------------------------------------------------


class ForgotPasswordRequest(BaseModel):
    """The address to send a reset link to."""

    email: str = Field(min_length=3)


class ForgotPasswordResponse(BaseModel):
    """The same message whether or not the account exists."""

    success: bool = True
    message: str


class ResetPasswordRequest(BaseModel):
    """The token from the reset link and the new password."""

    token: str = Field(min_length=20)
    password: str = Field(min_length=6)


class ResetPasswordResponse(BaseModel):
    """The account, signed in with its new password."""

    success: bool = True
    user: AuthUser
    session: AuthSession


class ChangePasswordRequest(BaseModel):
    """The current password (re-checked) and the new one."""

    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class ChangePasswordResponse(BaseModel):
    """The password changed; the session cookies are cleared, so the user signs in again."""

    success: bool = True
    message: str = "Password updated."
    requires_sign_in: bool = True


class ResendVerificationRequest(BaseModel):
    """The address to send a new verification link to."""

    email: str = Field(min_length=3)


class ResendVerificationResponse(BaseModel):
    """The same message whether or not a link was sent."""

    success: bool = True
    message: str


class VerifyEmailRequest(BaseModel):
    """The token from the verification link."""

    token: str = Field(min_length=20)


class VerifyEmailResponse(BaseModel):
    """The email is verified; the user signs in next (`session` is always empty)."""

    success: bool = True
    message: str
    user: AuthUser | None = None
    session: AuthSession | None = None


# --- account settings ----------------------------------------------------------------------------------


class ContactSharingSettings(BaseModel):
    """What the other side of a paid booking may see."""

    contact_phone: str | None = None
    share_email: bool = True
    share_phone: bool = True
    share_address: bool = True


class ContactSharingSettingsResponse(BaseModel):
    """The saved contact-sharing settings."""

    success: bool = True
    settings: ContactSharingSettings


class ContactSharingSettingsPutBody(BaseModel):
    """Fields to change; omitted fields are left alone. Vendors cannot set phone or address here."""

    contact_phone: str | None = Field(None, max_length=40)
    share_email: bool | None = None
    share_phone: bool | None = None
    share_address: bool | None = None


class ClientOnboardingState(BaseModel):
    """Whether a client finished first-visit setup, and what they like to be called."""

    completed: bool = False
    preferred_name: str | None = None


class ClientOnboardingResponse(BaseModel):
    """The client's onboarding state."""

    success: bool = True
    onboarding: ClientOnboardingState


class ClientOnboardingPatchBody(BaseModel):
    """Set the preferred name (blank clears it) and/or mark onboarding done."""

    preferred_name: str | None = Field(None, max_length=80)
    mark_completed: bool | None = None
