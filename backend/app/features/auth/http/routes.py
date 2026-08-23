"""Sign-up, sign-in, and session routes (Supabase Auth)."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response

from app.contracts.auth import (
    AuthSession,
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
from app.features.auth.http.dependencies import get_supabase_auth_service
from app.core.logging import get_logger
from app.features.auth import messages as auth_messages
from app.features.auth.session import (
    clear_session_cookies,
    get_current_user_or_raise,
    raise_session_auth_failure,
    set_session_cookies,
)
from app.features.auth.accounts import build_app_user, normalize_email, upsert_user_profile, assert_user_not_suspended

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


def _auth_session(raw: dict[str, Any]) -> AuthSession:
    return AuthSession.model_validate(raw)


@router.post("/signup", response_model=SignupResponse)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
):
    """Register with email and password. Client/vendor must verify email before sign-in."""
    from app.features.auth.email_verification import (
        confirm_supabase_email,
        issue_email_verification,
    )

    logger.info(
        "POST /auth/signup email=%s user_type=%s",
        body.email,
        body.user_type,
    )
    client_ip = _client_ip(request)

    service = get_supabase_auth_service()
    result = service.sign_up(body.email, body.password, body.user_type)
    if result.get("success"):
        logger.info("POST /auth/signup completed email=%s success=true", body.email)
        uid = result["user"].get("id")
        clear_session_cookies(response)
        if uid:
            upsert_user_profile(
                str(uid),
                normalize_email(body.email),
                body.user_type,
                clear_email_verified=True,
            )
            if body.user_type == "vendor" and body.referral_code:
                from app.features.referrals.attribution import try_attribute_vendor_signup

                try_attribute_vendor_signup(user_id=str(uid), referral_code=body.referral_code)
            confirm_supabase_email(str(uid))
            try:
                issue_email_verification(
                    user_id=str(uid),
                    email=body.email,
                    user_type=body.user_type,
                    client_ip=client_ip,
                )
            except ValueError as e:
                raise HTTPException(status_code=429, detail=str(e)) from e
        return SignupResponse(
            user=build_app_user(result["user"]),
            session=None,
            message=auth_messages.SIGNUP_VERIFY_MESSAGE,
        )
    logger.warning(
        "POST /auth/signup completed email=%s success=false error=%s",
        body.email,
        result.get("error"),
    )
    raise HTTPException(
        status_code=400,
        detail=result.get("error", auth_messages.SIGNUP_FAILED),
    )


@router.post("/signin", response_model=SignInResponse)
async def sign_in(
    body: SignInRequest,
    request: Request,
    response: Response,
):
    """Sign in with email and password."""
    from app.features.auth.email_verification import is_email_verified
    from app.features.auth.rate_limit import assert_sign_in_rate

    client_ip = _client_ip(request)
    try:
        assert_sign_in_rate(body.email, client_ip)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e

    service = get_supabase_auth_service()
    result = service.sign_in_with_password(
        email=body.email,
        password=body.password,
    )
    if result.get("success"):
        app_user = build_app_user(result["user"])
        if app_user.account_suspended:
            clear_session_cookies(response)
            raise HTTPException(
                status_code=403,
                detail=auth_messages.ADMIN_ACCOUNT_SUSPENDED_SIGNIN,
            )
        try:
            assert_user_not_suspended(app_user.id)
        except ValueError as e:
            clear_session_cookies(response)
            raise HTTPException(status_code=403, detail=str(e)) from e
        from app.features.auth.accounts import fetch_user_profile, profile_is_deleted

        if profile_is_deleted(fetch_user_profile(app_user.id)):
            clear_session_cookies(response)
            raise HTTPException(status_code=401, detail=auth_messages.ACCOUNT_DELETED_SIGNIN)
        ut = str(app_user.user_type or "")
        if ut in ("client", "vendor") and not is_email_verified(app_user.id, user_type=ut):
            clear_session_cookies(response)
            raise HTTPException(status_code=403, detail=auth_messages.UNVERIFIED_LOGIN_DETAIL)
        set_session_cookies(response, result["session"])
        return SignInResponse(
            success=True,
            user=app_user,
            session=_auth_session(result["session"]),
        )
    raise HTTPException(
        status_code=401,
        detail=result.get("error", auth_messages.LOGIN_CREDENTIALS_MISMATCH),
    )


@router.post("/signout", response_model=SignOutResponse)
async def sign_out(
    request: Request,
    response: Response,
):
    """Sign out. Client should clear stored tokens after calling this."""
    service = get_supabase_auth_service()
    result = service.sign_out()
    if result.get("success"):
        clear_session_cookies(response)
        return SignOutResponse(success=True)
    raise HTTPException(
        status_code=400,
        detail=result.get("error", auth_messages.SIGNOUT_FAILED),
    )


@router.post("/refresh", response_model=RefreshSessionResponse)
async def refresh_session(
    request: Request,
    body: RefreshSessionRequest,
    response: Response,
):
    """Exchange refresh token for new access and refresh tokens."""
    from app.core.constants import REFRESH_COOKIE_NAME

    refresh_token = body.refresh_token or request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail=auth_messages.REFRESH_SESSION_EXPIRED)

    service = get_supabase_auth_service()
    result = service.refresh_session(refresh_token=refresh_token)
    if result.get("success"):
        set_session_cookies(response, result["session"])
        return RefreshSessionResponse(
            success=True,
            user=build_app_user(result["user"]),
            session=_auth_session(result["session"]),
        )
    raise_session_auth_failure(
        response,
        result.get("error"),
        fallback=auth_messages.REFRESH_SESSION_EXPIRED,
    )


@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    response: Response,
):
    """Return the signed-in user from the cookie access token."""
    user = get_current_user_or_raise(request, response)
    return MeResponse(user=build_app_user(user))


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    if request.client:
        return request.client.host
    return None


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest, request: Request):
    """Send a one-click reset link when the email exists. Always returns the same message."""
    from app.features.auth.password_reset import request_password_reset

    try:
        message = request_password_reset(email=body.email, client_ip=_client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return ForgotPasswordResponse(message=message)


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    response: Response,
):
    """Consume a one-click reset token and set a new password; signs the user in."""
    from app.features.auth.email_verification import mark_email_verified
    from app.features.auth.password_reset import reset_password_with_token

    try:
        result = reset_password_with_token(
            token=body.token,
            password=body.password,
            client_ip=_client_ip(request),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    uid = str((result.get("user") or {}).get("id") or "")
    if uid:
        mark_email_verified(uid)
    set_session_cookies(response, result["session"])
    return ResetPasswordResponse(
        user=build_app_user(result["user"]),
        session=_auth_session(result["session"]),
    )


@router.post("/resend-verification", response_model=ResendVerificationResponse)
async def resend_verification(body: ResendVerificationRequest, request: Request):
    """Resend verify-email link. Always returns the same message (enumeration-safe)."""
    from app.features.auth.email_verification import resend_email_verification

    try:
        message = resend_email_verification(email=body.email, client_ip=_client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return ResendVerificationResponse(message=message)


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    body: VerifyEmailRequest,
    request: Request,
    response: Response,
):
    """Consume a one-click verify link."""
    from app.features.auth.email_verification import verify_email_with_token

    try:
        result = verify_email_with_token(token=body.token, client_ip=_client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    session = result.get("session")
    if session:
        set_session_cookies(response, session)
        return VerifyEmailResponse(
            message=auth_messages.EMAIL_VERIFIED_SIGNED_IN,
            user=build_app_user(result["user"]),
            session=_auth_session(session),
        )
    clear_session_cookies(response)
    raw_user = result.get("user")
    return VerifyEmailResponse(
        message=auth_messages.EMAIL_VERIFIED_SIGN_IN,
        user=build_app_user(raw_user) if isinstance(raw_user, dict) else None,
        session=None,
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password_route(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
):
    """Signed-in user changes password (current + new)."""
    from app.features.auth.password_reset import change_password

    user = get_current_user_or_raise(request, response)
    email = str(user.get("email") or "").strip()
    user_id = str(user.get("id") or "")
    if not email or not user_id:
        raise HTTPException(status_code=400, detail=auth_messages.UPDATE_PASSWORD_FAILED)
    try:
        change_password(
            user_id=user_id,
            email=email,
            current_password=body.current_password,
            new_password=body.new_password,
            client_ip=_client_ip(request),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    clear_session_cookies(response)
    return ChangePasswordResponse(
        message=auth_messages.PASSWORD_UPDATED_REAUTH,
        requires_sign_in=True,
    )
