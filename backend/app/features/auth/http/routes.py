"""Sign-up, sign-in, and session routes (Supabase, or an in-memory store for local use)."""

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.features.auth.http.dependencies import get_supabase_auth_service
from app.core.logging import get_logger
from app.features.auth import local_store as local_auth_store
from app.features.auth.session import (
    clear_session_cookies,
    get_current_user_or_raise,
    set_session_cookies,
)
from app.features.auth.accounts import hydrate_user_from_db, upsert_user_profile, assert_user_not_suspended

# --- Schemas  ---


class SignupRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    user_type: Literal["client", "vendor"] = "client"
    options: dict | None = None


class SignupResponse(BaseModel):
    success: bool = True
    user: dict[str, Any]
    session: dict[str, Any] | None = None
    message: str | None = None


class SignInRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class SignInResponse(BaseModel):
    success: bool = True
    user: dict[str, Any]
    session: dict[str, Any]


class SignOutResponse(BaseModel):
    success: bool = True


class RefreshSessionRequest(BaseModel):
    refresh_token: str | None = Field(default=None)


class RefreshSessionResponse(BaseModel):
    success: bool = True
    user: dict[str, Any]
    session: dict[str, Any]


class MeResponse(BaseModel):
    success: bool = True
    user: dict[str, Any]


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
    user: dict[str, Any]
    session: dict[str, Any]


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
    user: dict[str, Any] | None = None
    session: dict[str, Any] | None = None


# --- Routes ---

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post("/signup", response_model=SignupResponse)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
):
    """Register with email and password. Client/vendor must verify email before sign-in."""
    from app.features.auth.email_verification import (
        SIGNUP_VERIFY_MESSAGE,
        confirm_supabase_email,
        issue_email_verification,
    )

    logger.info(
        "POST /auth/signup email=%s user_type=%s",
        body.email,
        body.user_type,
    )
    client_ip = _client_ip(request)

    if local_auth_store.enabled():
        try:
            user = local_auth_store.register_user(body.email, body.password, body.user_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="That email is already registered. Try signing in.") from None
        clear_session_cookies(response)
        try:
            issue_email_verification(
                user_id=str(user["id"]),
                email=body.email,
                user_type=body.user_type,
                client_ip=client_ip,
            )
        except ValueError as e:
            raise HTTPException(status_code=429, detail=str(e)) from e
        return SignupResponse(
            user=hydrate_user_from_db(user),
            session=None,
            message=SIGNUP_VERIFY_MESSAGE,
        )

    service = get_supabase_auth_service()
    data_meta: dict[str, Any] = {"user_type": body.user_type}
    if body.options and isinstance(body.options.get("data"), dict):
        data_meta = {**body.options["data"], **data_meta}
    signup_options: dict[str, Any] = {"data": data_meta}
    if body.options:
        for key, val in body.options.items():
            if key != "data":
                signup_options[key] = val
    result = service.sign_up(body.email, body.password, signup_options)
    if result.get("success"):
        logger.info("POST /auth/signup completed email=%s success=true", body.email)
        uid = result["user"].get("id")
        clear_session_cookies(response)
        if uid:
            upsert_user_profile(
                str(uid),
                local_auth_store.normalize_email(body.email),
                body.user_type,
                clear_email_verified=True,
            )
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
            user=hydrate_user_from_db(result["user"]),
            session=None,
            message=SIGNUP_VERIFY_MESSAGE,
        )
    logger.warning(
        "POST /auth/signup completed email=%s success=false error=%s",
        body.email,
        result.get("error"),
    )
    raise HTTPException(
        status_code=400,
        detail=result.get("error", "We couldn't create your account. Please try again."),
    )


@router.post("/signin", response_model=SignInResponse)
async def sign_in(
    body: SignInRequest,
    request: Request,
    response: Response,
):
    """Sign in with email and password."""
    from app.features.auth.email_verification import UNVERIFIED_LOGIN_DETAIL, is_email_verified
    from app.features.auth.rate_limit import assert_sign_in_rate

    client_ip = _client_ip(request)
    try:
        assert_sign_in_rate(body.email, client_ip)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e

    if local_auth_store.enabled():
        user = local_auth_store.authenticate(body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="We couldn't sign you in with those details. Check your email and password, then try again.")
        try:
            assert_user_not_suspended(str(user.get("id") or ""))
        except ValueError as e:
            raise HTTPException(status_code=403, detail=str(e)) from e
        uid = str(user.get("id") or "")
        ut = str(user.get("user_type") or "")
        if ut in ("client", "vendor") and not is_email_verified(uid, user_type=ut):
            clear_session_cookies(response)
            raise HTTPException(status_code=403, detail=UNVERIFIED_LOGIN_DETAIL)
        session = local_auth_store.create_session(body.email)
        set_session_cookies(response, session)
        return SignInResponse(
            success=True,
            user=hydrate_user_from_db(user),
            session=session,
        )

    service = get_supabase_auth_service()
    result = service.sign_in_with_password(
        email=body.email,
        password=body.password,
    )
    if result.get("success"):
        hydrated = hydrate_user_from_db(result["user"])
        if hydrated.get("account_suspended"):
            clear_session_cookies(response)
            raise HTTPException(
                status_code=403,
                detail="This account is suspended. Contact a super admin if you need access.",
            )
        try:
            assert_user_not_suspended(str(hydrated.get("id") or ""))
        except ValueError as e:
            clear_session_cookies(response)
            raise HTTPException(status_code=403, detail=str(e)) from e
        uid = str(hydrated.get("id") or "")
        ut = str(hydrated.get("user_type") or "")
        if ut in ("client", "vendor") and not is_email_verified(uid, user_type=ut):
            clear_session_cookies(response)
            raise HTTPException(status_code=403, detail=UNVERIFIED_LOGIN_DETAIL)
        set_session_cookies(response, result["session"])
        return SignInResponse(
            success=True,
            user=hydrated,
            session=result["session"],
        )
    raise HTTPException(
        status_code=401,
        detail=result.get("error", "We couldn't sign you in with those details. Check your email and password, then try again."),
    )


@router.post("/signout", response_model=SignOutResponse)
async def sign_out(
    request: Request,
    response: Response,
):
    """Sign out. Client should clear stored tokens after calling this."""
    if local_auth_store.enabled():
        from app.core.constants import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME

        access_token = request.cookies.get(ACCESS_COOKIE_NAME)
        refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
        if access_token:
            local_auth_store.revoke_access_token(access_token)
        if refresh_token:
            local_auth_store.revoke_refresh_token(refresh_token)
        clear_session_cookies(response)
        return SignOutResponse(success=True)

    service = get_supabase_auth_service()
    result = service.sign_out()
    if result.get("success"):
        clear_session_cookies(response)
        return SignOutResponse(success=True)
    raise HTTPException(
        status_code=400,
        detail=result.get("error", "We couldn't sign you out. Please try again."),
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
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    if local_auth_store.enabled():
        email = local_auth_store.email_for_refresh_token(refresh_token)
        if not email:
            raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
        local_auth_store.revoke_refresh_token(refresh_token)
        session = local_auth_store.create_session(email)
        set_session_cookies(response, session)
        user = local_auth_store.user_record_for_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="Please sign in again.")
        return RefreshSessionResponse(
            success=True,
            user=hydrate_user_from_db(user),
            session=session,
        )

    service = get_supabase_auth_service()
    result = service.refresh_session(refresh_token=refresh_token)
    if result.get("success"):
        set_session_cookies(response, result["session"])
        return RefreshSessionResponse(
            success=True,
            user=hydrate_user_from_db(result["user"]),
            session=result["session"],
        )
    clear_session_cookies(response)
    raise HTTPException(
        status_code=401,
        detail=result.get("error", "Your session has expired. Please sign in again."),
    )


@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    response: Response,
):
    """Return the signed-in user from the cookie access token."""
    user = get_current_user_or_raise(request, response)
    return MeResponse(user=hydrate_user_from_db(user))


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
        user=hydrate_user_from_db(result["user"]),
        session=result["session"],
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
    """Consume a one-click verify link. Signs in automatically in local auth only."""
    from app.features.auth.email_verification import verify_email_with_token

    try:
        result = verify_email_with_token(token=body.token, client_ip=_client_ip(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    session = result.get("session")
    if session:
        set_session_cookies(response, session)
        return VerifyEmailResponse(
            message="Email verified. You're signed in.",
            user=hydrate_user_from_db(result["user"]),
            session=session,
        )
    clear_session_cookies(response)
    return VerifyEmailResponse(
        message="Email verified. You can sign in now.",
        user=result.get("user"),
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
        raise HTTPException(status_code=400, detail="Could not update password. Try again.")
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
        message="Password updated. Sign in again with your new password.",
        requires_sign_in=True,
    )
