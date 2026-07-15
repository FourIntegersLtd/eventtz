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
from app.features.auth.accounts import hydrate_user_from_db, upsert_user_profile
from app.features.email.dispatch import send_welcome_email

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


# --- Routes ---

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post("/signup", response_model=SignupResponse)
async def signup(
    body: SignupRequest,
    response: Response,
):
    """Register with email and password. Saves user_type to public.users when the database is available."""
    logger.info(
        "POST /auth/signup email=%s user_type=%s",
        body.email,
        body.user_type,
    )
    if local_auth_store.enabled():
        try:
            user = local_auth_store.register_user(body.email, body.password, body.user_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="That email is already registered. Try signing in.") from None
        session = local_auth_store.create_session(body.email)
        set_session_cookies(response, session)
        return SignupResponse(
            user=hydrate_user_from_db(user),
            session=session,
            message="Local auth mode enabled: account created in memory.",
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
        if uid:
            upsert_user_profile(
                str(uid),
                local_auth_store.normalize_email(body.email),
                body.user_type,
            )
        if result.get("session"):
            set_session_cookies(response, result["session"])
        send_welcome_email(email=body.email, user_type=body.user_type)
        return SignupResponse(
            user=hydrate_user_from_db(result["user"]),
            session=result.get("session"),
            message=result.get("message"),
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
    response: Response,
):
    """Sign in with email and password."""
    if local_auth_store.enabled():
        user = local_auth_store.authenticate(body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="We couldn't sign you in with those details. Check your email and password, then try again.")
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
        set_session_cookies(response, result["session"])
        return SignInResponse(
            success=True,
            user=hydrate_user_from_db(result["user"]),
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
