"""Auth API contracts (signup, sign-in, session, password reset, email verification)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.types import AdminRole, UserType


class AuthUser(BaseModel):
    """Merged auth identity + Eventtz app profile returned on sign-in and /me."""

    id: str
    email: str | None = None
    user_type: UserType | str = "client"
    admin_role: AdminRole | str | None = None
    account_suspended: bool = False
    email_verified: bool | None = None
    preferred_name: str | None = None
    client_onboarding_completed: bool | None = None
    user_metadata: dict[str, Any] = Field(default_factory=dict)
    app_metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")

    def get(self, key: str, default: Any = None) -> Any:
        """Dict-style access for legacy handlers (prefer attribute access in new code)."""
        return self.model_dump().get(key, default)


class AuthSession(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int | None = None

    model_config = ConfigDict(extra="ignore")


class SignupRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    user_type: Literal["client", "vendor"] = "client"
    referral_code: str | None = None


class SignupResponse(BaseModel):
    success: bool = True
    user: AuthUser
    session: AuthSession | None = None
    message: str | None = None


class SignInRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class SignInResponse(BaseModel):
    success: bool = True
    user: AuthUser
    session: AuthSession


class SignOutResponse(BaseModel):
    success: bool = True


class RefreshSessionRequest(BaseModel):
    refresh_token: str | None = Field(default=None)


class RefreshSessionResponse(BaseModel):
    success: bool = True
    user: AuthUser
    session: AuthSession


class MeResponse(BaseModel):
    success: bool = True
    user: AuthUser


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3)


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=6)


class ResetPasswordResponse(BaseModel):
    success: bool = True
    user: AuthUser
    session: AuthSession


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class ChangePasswordResponse(BaseModel):
    success: bool = True
    message: str = "Password updated."
    requires_sign_in: bool = True


class ResendVerificationRequest(BaseModel):
    email: str = Field(min_length=3)


class ResendVerificationResponse(BaseModel):
    success: bool = True
    message: str


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20)


class VerifyEmailResponse(BaseModel):
    success: bool = True
    message: str
    user: AuthUser | None = None
    session: AuthSession | None = None
