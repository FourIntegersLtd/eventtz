"""Account routes under `/auth`: sign up, sign in and out, sessions, email links and passwords.

The API sets no cookies: sessions travel as `Authorization: Bearer` access tokens,
and the web app sends the refresh token in the body. Everything else is in the services.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import (
    AUTH_ERRORS,
    AccountDeleted,
    AnyAccount,
    CurrentUser,
    OptionalUser,
    SessionExpired,
)
from app.core.db import SessionDep
from app.core.errors import AppError, Forbidden, error_responses
from app.core.ports import MailerDependency
from app.core.rate_limit import CallerKey
from app.features.identity import service_passwords, service_session, service_signup
from app.features.identity.errors import (
    CurrentPasswordIncorrect,
    EmailAlreadyRegistered,
    EmailNotVerified,
    PasswordUnchanged,
    PasswordUpdateFailed,
    RefreshTokenReused,
    ResetLinkInvalid,
    ResetLinkUsed,
    SuspendedAtSignIn,
    TooManyLinkAttempts,
    TooManyPasswordChanges,
    TooManyResetRequests,
    TooManySignIns,
    TooManyVerificationEmails,
    VerificationLinkInvalid,
    VerifyEmailFailed,
    WeakPassword,
    WrongCredentials,
)
from app.features.identity.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    MeResponse,
    RefreshSessionRequest,
    RefreshSessionResponse,
    ResendVerificationRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    SignInRequest,
    SignInResponse,
    SignOutRequest,
    SignOutResponse,
    SignupRequest,
    SignupResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=SignupResponse,
    responses=error_responses(EmailAlreadyRegistered, TooManyVerificationEmails),
)
async def sign_up(
    body: SignupRequest, session: SessionDep, caller: CallerKey, mailer: MailerDependency
) -> SignupResponse:
    """Create an unverified client or vendor account; the user verifies their email, then signs in."""
    return await service_signup.sign_up(session, body, caller=caller, mailer=mailer)


@router.post(
    "/signin",
    response_model=SignInResponse,
    responses=error_responses(
        TooManySignIns, WrongCredentials, SuspendedAtSignIn, AccountDeleted, EmailNotVerified
    ),
)
async def sign_in(body: SignInRequest, session: SessionDep, caller: CallerKey) -> SignInResponse:
    """Sign in with email and password."""
    return await service_session.sign_in(session, body, caller=caller)


@router.post("/signout", response_model=SignOutResponse, responses=error_responses(AppError))
async def sign_out(
    session: SessionDep, principal: OptionalUser, body: SignOutRequest | None = None
) -> SignOutResponse:
    """End the presented sign-in, or all of the caller's. Succeeds even without a session."""
    await service_session.sign_out(
        session, principal=principal, refresh_token=body.refresh_token if body is not None else None
    )
    return SignOutResponse()


@router.post(
    "/refresh",
    response_model=RefreshSessionResponse,
    responses=error_responses(SessionExpired, RefreshTokenReused),
)
async def refresh_session(body: RefreshSessionRequest, session: SessionDep) -> RefreshSessionResponse:
    """Swap the refresh token for a new session."""
    return await service_session.refresh(session, body.refresh_token)


@router.get("/me", response_model=MeResponse, responses=error_responses(*AUTH_ERRORS, Forbidden))
async def me(principal: CurrentUser, session: SessionDep) -> MeResponse:
    """The signed-in account."""
    return await service_session.me(session, principal)


@router.post(
    "/forgot-password", response_model=ForgotPasswordResponse, responses=error_responses(TooManyResetRequests)
)
async def forgot_password(
    body: ForgotPasswordRequest, session: SessionDep, caller: CallerKey, mailer: MailerDependency
) -> ForgotPasswordResponse:
    """Email a reset link if the account exists. The answer is the same either way."""
    return ForgotPasswordResponse(
        message=await service_passwords.request_reset(session, body.email, caller=caller, mailer=mailer)
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    responses=error_responses(
        TooManyLinkAttempts, ResetLinkInvalid, ResetLinkUsed, WeakPassword, PasswordUpdateFailed
    ),
)
async def reset_password(
    body: ResetPasswordRequest, session: SessionDep, caller: CallerKey, mailer: MailerDependency
) -> ResetPasswordResponse:
    """Follow a reset link: set the new password and sign in with it."""
    return await service_passwords.reset_with_link(
        session, body.token, body.password, caller=caller, mailer=mailer
    )


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    responses=error_responses(TooManyVerificationEmails),
)
async def resend_verification(
    body: ResendVerificationRequest, session: SessionDep, caller: CallerKey, mailer: MailerDependency
) -> ResendVerificationResponse:
    """Send a new verification link if the account still needs one. The answer is the same either way."""
    return ResendVerificationResponse(
        message=await service_signup.resend_verification(session, body.email, caller=caller, mailer=mailer)
    )


@router.post(
    "/verify-email",
    response_model=VerifyEmailResponse,
    responses=error_responses(TooManyLinkAttempts, VerificationLinkInvalid, VerifyEmailFailed),
)
async def verify_email(
    body: VerifyEmailRequest, session: SessionDep, caller: CallerKey, mailer: MailerDependency
) -> VerifyEmailResponse:
    """Follow a verification link. No session is issued: the user signs in next."""
    return await service_signup.verify_email(session, body.token, caller=caller, mailer=mailer)


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
    responses=error_responses(
        *AUTH_ERRORS,
        PasswordUpdateFailed,
        TooManyPasswordChanges,
        WeakPassword,
        PasswordUnchanged,
        CurrentPasswordIncorrect,
    ),
)
async def change_password(
    body: ChangePasswordRequest,
    principal: AnyAccount,
    session: SessionDep,
    caller: CallerKey,
    mailer: MailerDependency,
) -> ChangePasswordResponse:
    """Change the password (the current one is re-checked); every sign-in ends, including this one."""
    return await service_passwords.change_password(
        session,
        principal,
        current_password=body.current_password,
        new_password=body.new_password,
        caller=caller,
        mailer=mailer,
    )
