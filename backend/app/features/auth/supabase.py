"""Sign-in and session helpers for Supabase Auth."""

from typing import Any

from supabase import Client
from supabase_auth.errors import AuthApiError

from app.core.logging import get_logger
from app.core.db import get_supabase_auth_client
from app.features.auth.accounts import normalize_email
from app.features.auth import messages as auth_messages

logger = get_logger(__name__)


def _fail(error: str) -> dict[str, Any]:
    return {"success": False, "error": error}


def _user_info(user: Any) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": getattr(user, "email", None),
        "user_metadata": getattr(user, "user_metadata", None) or {},
        "app_metadata": getattr(user, "app_metadata", None) or {},
    }


def _session_data(session: Any) -> dict[str, Any] | None:
    if not session:
        return None
    data: dict[str, Any] = {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
    }
    if hasattr(session, "expires_at") and session.expires_at is not None:
        data["expires_at"] = session.expires_at
    return data


def _authenticated(user: Any, session: Any) -> dict[str, Any]:
    return {"success": True, "user": _user_info(user), "session": _session_data(session)}


def _signup_is_existing_user(user: Any) -> bool:
    """Supabase returns a fake user (empty identities) when email already exists."""
    identities = getattr(user, "identities", None)
    if identities is None and hasattr(user, "model_dump"):
        identities = user.model_dump().get("identities")
    return identities == []


def _signup_email_taken(err: AuthApiError) -> bool:
    msg = str(err).lower()
    return "already registered" in msg or "already been registered" in msg


class SupabaseAuthService:
    def __init__(self, client: Client | None = None) -> None:
        self._client = client or get_supabase_auth_client()

    def sign_up(self, email: str, password: str, user_type: str) -> dict[str, Any]:
        email = normalize_email(email)
        logger.info("sign_up started email=%s user_type=%s", email, user_type)
        try:
            response = self._client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {"data": {"user_type": user_type}},
                },
            )
            user = response.user
            if not user:
                logger.warning("sign_up finished without user email=%s", email)
                return _fail(auth_messages.SIGNUP_FAILED)
            if _signup_is_existing_user(user):
                logger.info("sign_up rejected email=%s (already registered)", email)
                return _fail(auth_messages.SIGNUP_EMAIL_EXISTS)
            logger.info("sign_up success email=%s user_id=%s", email, user.id)
            return _authenticated(user, response.session)
        except AuthApiError as e:
            if _signup_email_taken(e):
                logger.info("sign_up rejected email=%s (already registered)", email)
                return _fail(auth_messages.SIGNUP_EMAIL_EXISTS)
            logger.info("sign_up rejected email=%s error=%s", email, e)
            return _fail(auth_messages.SIGNUP_FAILED)
        except Exception:
            logger.exception("sign_up failed email=%s", email)
            return _fail(auth_messages.SIGNUP_FAILED)

    def sign_in_with_password(self, email: str, password: str) -> dict[str, Any]:
        email = normalize_email(email)
        logger.info("sign_in started email=%s", email)
        try:
            response = self._client.auth.sign_in_with_password(
                {"email": email, "password": password},
            )
            if not response.user or not response.session:
                logger.warning("sign_in failed email=%s (no session or user)", email)
                return _fail(auth_messages.LOGIN_CREDENTIALS_MISMATCH)
            logger.info("sign_in success email=%s user_id=%s", email, response.user.id)
            return _authenticated(response.user, response.session)
        except AuthApiError as e:
            err = str(e).lower()
            if "invalid login credentials" in err or "invalid credentials" in err:
                logger.info("sign_in rejected email=%s (invalid credentials)", email)
                return _fail(auth_messages.LOGIN_CREDENTIALS_REREGISTER)
            if "email not confirmed" in err:
                logger.info("sign_in rejected email=%s (email not confirmed)", email)
                return _fail(auth_messages.EMAIL_NOT_CONFIRMED_SUPABASE)
            logger.info("sign_in rejected email=%s error=%s", email, e)
            return _fail(auth_messages.SIGN_IN_UNAVAILABLE)
        except Exception:
            logger.exception("sign_in failed email=%s", email)
            return _fail(auth_messages.SIGN_IN_UNAVAILABLE)

    def sign_out(self) -> dict[str, Any]:
        try:
            self._client.auth.sign_out()
            return {"success": True}
        except Exception:
            logger.exception("sign_out failed")
            return _fail(auth_messages.SIGNOUT_FAILED)

    def refresh_session(self, refresh_token: str) -> dict[str, Any]:
        try:
            response = self._client.auth.refresh_session(refresh_token)
            if not response.user or not response.session:
                logger.warning("refresh_session failed (no session or user)")
                return _fail(auth_messages.REFRESH_SESSION_EXPIRED)
            logger.info("refresh_session success user_id=%s", response.user.id)
            return _authenticated(response.user, response.session)
        except AuthApiError as e:
            logger.debug("refresh_session rejected token: %s", e)
            return _fail(auth_messages.REFRESH_SESSION_EXPIRED)
        except Exception:
            logger.exception("refresh_session failed")
            return _fail(auth_messages.REFRESH_SESSION_EXPIRED)

    def get_user_from_access_token(self, access_token: str) -> dict[str, Any]:
        try:
            user = self._client.auth.get_user(access_token).user
            if not user:
                return _fail(auth_messages.SIGN_IN_REQUIRED)
            return {"success": True, "user": _user_info(user)}
        except AuthApiError as e:
            logger.debug("get_user_from_access_token rejected token: %s", e)
            return _fail(auth_messages.SIGN_IN_REQUIRED)
        except Exception:
            logger.exception("get_user_from_access_token failed")
            return _fail(auth_messages.SIGN_IN_REQUIRED)
