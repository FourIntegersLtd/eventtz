"""Account routes under `/auth`: sign up, sign in and out, sessions, email links and passwords.

Routes that start or end a session set or clear the httpOnly session cookies here; everything
else is in the services.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.core.auth import (
    ACCESS_COOKIE,
    AUTH_ERRORS,
    REFRESH_COOKIE,
    AnyAccount,
    CurrentUser,
    clear_session_cookies,
    set_session_cookies,
)
from app.core.client_ip import ClientIp
from app.core.errors import AppError, Forbidden, error_responses
from app.core.ports import MailerDependency
from app.features.identity import service_passwords, service_session, service_signup
from app.features.identity.errors import (
    AuthServiceUnavailable,
    CurrentPasswordIncorrect,
    DeletedAtSignIn,
    EmailAlreadyRegistered,
    EmailNotConfirmed,
    EmailNotVerified,
    PasswordUnchanged,
    PasswordUpdateFailed,
    RefreshExpired,
    ResetLinkInvalid,
    ResetLinkUsed,
    ResetSignInFailed,
    SignInFailed,
    SignInUnavailable,
    SignupFailed,
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
    responses=error_responses(
        EmailAlreadyRegistered, SignupFailed, AuthServiceUnavailable, TooManyVerificationEmails
    ),
)
def sign_up(
    body: SignupRequest, response: Response, caller_ip: ClientIp, mailer: MailerDependency
) -> SignupResponse:
    """Create an unverified client or vendor account; the user verifies their email, then signs in."""
    created = service_signup.sign_up(body, client_ip=caller_ip, mailer=mailer)
    clear_session_cookies(response)
    return created


@router.post(
    "/signin",
    response_model=SignInResponse,
    responses=error_responses(
        TooManySignIns,
        WrongCredentials,
        EmailNotConfirmed,
        SignInFailed,
        SignInUnavailable,
        SuspendedAtSignIn,
        DeletedAtSignIn,
        EmailNotVerified,
    ),
)
def sign_in(body: SignInRequest, response: Response, caller_ip: ClientIp) -> SignInResponse:
    """Sign in with email and password; the session is also set as cookies."""
    signed_in = service_session.sign_in(body, client_ip=caller_ip)
    set_session_cookies(response, signed_in.session.access_token, signed_in.session.refresh_token)
    return signed_in


@router.post("/signout", response_model=SignOutResponse, responses=error_responses(AppError))
def sign_out(request: Request, response: Response) -> SignOutResponse:
    """End this browser's session and clear its cookies. Succeeds even without a session."""
    service_session.sign_out(request.cookies.get(ACCESS_COOKIE))
    clear_session_cookies(response)
    return SignOutResponse()


@router.post(
    "/refresh",
    response_model=RefreshSessionResponse,
    responses=error_responses(RefreshExpired, AuthServiceUnavailable),
)
def refresh_session(
    body: RefreshSessionRequest, request: Request, response: Response
) -> RefreshSessionResponse:
    """Swap the refresh token (from the body, else the cookie) for a new session."""
    refreshed = service_session.refresh(body.refresh_token or request.cookies.get(REFRESH_COOKIE))
    set_session_cookies(response, refreshed.session.access_token, refreshed.session.refresh_token)
    return refreshed


@router.get("/me", response_model=MeResponse, responses=error_responses(*AUTH_ERRORS, Forbidden))
def me(principal: CurrentUser) -> MeResponse:
    """The signed-in account."""
    return service_session.me(principal)


@router.post(
    "/forgot-password", response_model=ForgotPasswordResponse, responses=error_responses(TooManyResetRequests)
)
def forgot_password(
    body: ForgotPasswordRequest, caller_ip: ClientIp, mailer: MailerDependency
) -> ForgotPasswordResponse:
    """Email a reset link if the account exists. The answer is the same either way."""
    return ForgotPasswordResponse(
        message=service_passwords.request_reset(body.email, client_ip=caller_ip, mailer=mailer)
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    responses=error_responses(
        TooManyLinkAttempts,
        ResetLinkInvalid,
        ResetLinkUsed,
        WeakPassword,
        PasswordUpdateFailed,
        ResetSignInFailed,
    ),
)
def reset_password(
    body: ResetPasswordRequest, response: Response, caller_ip: ClientIp, mailer: MailerDependency
) -> ResetPasswordResponse:
    """Follow a reset link: set the new password and sign in with it."""
    reset = service_passwords.reset_with_link(body.token, body.password, client_ip=caller_ip, mailer=mailer)
    set_session_cookies(response, reset.session.access_token, reset.session.refresh_token)
    return reset


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    responses=error_responses(TooManyVerificationEmails),
)
def resend_verification(
    body: ResendVerificationRequest, caller_ip: ClientIp, mailer: MailerDependency
) -> ResendVerificationResponse:
    """Send a new verification link if the account still needs one. The answer is the same either way."""
    return ResendVerificationResponse(
        message=service_signup.resend_verification(body.email, client_ip=caller_ip, mailer=mailer)
    )


@router.post(
    "/verify-email",
    response_model=VerifyEmailResponse,
    responses=error_responses(TooManyLinkAttempts, VerificationLinkInvalid, VerifyEmailFailed),
)
def verify_email(
    body: VerifyEmailRequest, response: Response, caller_ip: ClientIp, mailer: MailerDependency
) -> VerifyEmailResponse:
    """Follow a verification link. The user signs in next, so any old session cookies are cleared."""
    verified = service_signup.verify_email(body.token, client_ip=caller_ip, mailer=mailer)
    clear_session_cookies(response)
    return verified


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
        AuthServiceUnavailable,
    ),
)
def change_password(
    body: ChangePasswordRequest,
    principal: AnyAccount,
    response: Response,
    caller_ip: ClientIp,
    mailer: MailerDependency,
) -> ChangePasswordResponse:
    """Change the password (the current one is re-checked); every session ends, including this one."""
    changed = service_passwords.change_password(
        principal,
        current_password=body.current_password,
        new_password=body.new_password,
        client_ip=caller_ip,
        mailer=mailer,
    )
    clear_session_cookies(response)
    return changed
