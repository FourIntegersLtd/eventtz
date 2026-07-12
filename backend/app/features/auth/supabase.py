"""Supabase Auth helpers."""

from typing import Any

from supabase import Client
from supabase_auth.errors import AuthApiError

from app.core.logging import get_logger
from app.core.db import get_supabase_auth_client

logger = get_logger(__name__)


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


class SupabaseAuthService:
    def __init__(self, client: Client | None = None) -> None:
        self._client = client or get_supabase_auth_client()

    def sign_up(self, email: str, password: str, options: dict | None = None) -> dict:
        logger.info("sign_up started email=%s", email)
        try:
            creds: dict = {"email": email, "password": password}
            if options is not None:
                creds["options"] = options
            response = self._client.auth.sign_up(creds)
            user = response.user
            session = response.session
            if not user:
                logger.warning("sign_up finished without user email=%s", email)
                return {"success": False, "error": "No user returned"}
            if session:
                logger.info(
                    "sign_up success email=%s user_id=%s has_session=true",
                    email,
                    user.id,
                )
                return {
                    "success": True,
                    "session": _session_data(session),
                    "user": _user_info(user),
                }
            logger.info(
                "sign_up success email=%s user_id=%s has_session=false (confirm email)",
                email,
                user.id,
            )
            return {
                "success": True,
                "session": None,
                "user": _user_info(user),
                "message": "Account created. Please check your email for confirmation.",
            }
        except AuthApiError as e:
            err = str(e).lower()
            if "already registered" in err or "already been registered" in err:
                return {
                    "success": False,
                    "error": (
                        "An account with this email already exists in Supabase Auth. "
                        "Sign in instead, or delete the user under Authentication → Users "
                        "if you are resetting a dev database."
                    ),
                }
            logger.info("sign_up rejected email=%s error=%s", email, e)
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.exception("sign_up failed email=%s", email)
            return {"success": False, "error": str(e)}

    def sign_in_with_password(self, email: str, password: str) -> dict[str, Any]:
        logger.info("sign_in started email=%s", email)
        try:
            response = self._client.auth.sign_in_with_password(
                {"email": email, "password": password},
            )
            user = response.user
            session = response.session
            if not session or not user:
                logger.warning("sign_in failed email=%s (no session or user)", email)
                return {"success": False, "error": "Invalid credentials"}
            logger.info("sign_in success email=%s user_id=%s", email, user.id)
            return {
                "success": True,
                "user": _user_info(user),
                "session": _session_data(session),
            }
        except AuthApiError as e:
            err = str(e).lower()
            if "invalid login credentials" in err or "invalid credentials" in err:
                logger.info("sign_in rejected email=%s (invalid credentials)", email)
                return {"success": False, "error": "Invalid credentials"}
            logger.info("sign_in rejected email=%s error=%s", email, e)
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.exception("sign_in failed email=%s", email)
            return {"success": False, "error": str(e)}

    def sign_out(self) -> dict[str, Any]:
        logger.info("sign_out started")
        try:
            self._client.auth.sign_out()
            logger.info("sign_out success")
            return {"success": True}
        except Exception as e:
            logger.exception("sign_out failed")
            return {"success": False, "error": str(e)}

    def refresh_session(self, refresh_token: str) -> dict[str, Any]:
        logger.info("refresh_session started")
        try:
            response = self._client.auth.refresh_session(refresh_token)
            user = response.user
            session = response.session
            if not session or not user:
                logger.warning("refresh_session failed (no session or user)")
                return {"success": False, "error": "Refresh failed"}
            logger.info("refresh_session success user_id=%s", user.id)
            return {
                "success": True,
                "user": _user_info(user),
                "session": _session_data(session),
            }
        except AuthApiError as e:
            logger.debug("refresh_session rejected token: %s", e)
            return {"success": False, "error": "Refresh failed"}
        except Exception as e:
            logger.exception("refresh_session failed")
            return {"success": False, "error": str(e)}

    def get_user_from_access_token(self, access_token: str) -> dict[str, Any]:
        try:
            response = self._client.auth.get_user(access_token)
            user = response.user
            if not user:
                logger.warning("get_user_from_access_token failed (no user)")
                return {"success": False, "error": "Unauthorized"}
            return {"success": True, "user": _user_info(user)}
        except AuthApiError as e:
            # Expired / revoked session (e.g. after sign-out), malformed JWT — routine, not server bugs.
            logger.debug("get_user_from_access_token rejected token: %s", e)
            return {"success": False, "error": "Unauthorized"}
        except Exception:
            logger.exception("get_user_from_access_token failed")
            return {"success": False, "error": "Unauthorized"}
