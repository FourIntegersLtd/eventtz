"""Supabase Auth calls: sign-up, sign-in, refresh, sign-out and admin password/confirmation changes.

Each call answers with a model on success or an `AuthRefusal` tag on failure, so services decide
the user-facing error and never see SDK exceptions. `"unavailable"` means Supabase did not answer.
"""

from __future__ import annotations

from typing import Any, Literal

from supabase_auth.errors import AuthApiError

from app.core import db
from app.core.logging import get_logger
from app.features.identity.models import AuthenticatedSession, AuthIdentity, AuthRefusal, AuthTokens

log = get_logger(__name__)


def _identity(user: Any) -> AuthIdentity:
    """A Supabase SDK user as our model."""
    return AuthIdentity(
        id=str(user.id),
        email=getattr(user, "email", None),
        user_metadata=getattr(user, "user_metadata", None) or {},
        app_metadata=getattr(user, "app_metadata", None) or {},
    )


def _authenticated(user: Any, session: Any) -> AuthenticatedSession:
    """A Supabase SDK user + session as our model."""
    return AuthenticatedSession(
        identity=_identity(user),
        tokens=AuthTokens(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            expires_at=getattr(session, "expires_at", None),
        ),
    )


def _is_fake_signup(user: Any) -> bool:
    """Supabase answers a sign-up for an existing email with a stand-in user that has no identities."""
    identities = getattr(user, "identities", None)
    if identities is None and hasattr(user, "model_dump"):
        identities = user.model_dump().get("identities")
    return identities == []


def _failure(action: str, exc: Exception) -> AuthRefusal:
    """Classify an unexpected SDK exception: an outage, or a refusal we log for follow-up."""
    if db.is_upstream_unavailable(exc):
        log.warning("auth: %s - Supabase Auth did not answer", action)
        return "unavailable"
    log.exception("auth: %s failed", action)
    return "refused"


def sign_up(*, email: str, password: str, user_type: str) -> AuthIdentity | AuthRefusal:
    """Create a Supabase Auth user, recording the account type in its metadata."""
    try:
        response = db.auth_client().auth.sign_up(
            {"email": email, "password": password, "options": {"data": {"user_type": user_type}}}
        )
    except AuthApiError as exc:
        message = str(exc).lower()
        if "already registered" in message or "already been registered" in message:
            return "email_taken"
        log.info("auth: sign-up refused: %s", exc)
        return "refused"
    except Exception as exc:
        return _failure("sign-up", exc)
    if response.user is None:
        return "refused"
    if _is_fake_signup(response.user):
        return "email_taken"
    return _identity(response.user)


def sign_in(*, email: str, password: str) -> AuthenticatedSession | AuthRefusal:
    """Exchange email and password for a session."""
    try:
        response = db.auth_client().auth.sign_in_with_password({"email": email, "password": password})
    except AuthApiError as exc:
        message = str(exc).lower()
        if "invalid login credentials" in message or "invalid credentials" in message:
            return "wrong_credentials"
        if "email not confirmed" in message:
            return "email_not_confirmed"
        log.info("auth: sign-in refused: %s", exc)
        return "refused"
    except Exception as exc:
        return _failure("sign-in", exc)
    if response.user is None or response.session is None:
        return "refused"
    return _authenticated(response.user, response.session)


def refresh(refresh_token: str) -> AuthenticatedSession | AuthRefusal:
    """Exchange a refresh token for a new session."""
    try:
        response = db.auth_client().auth.refresh_session(refresh_token)
    except AuthApiError:
        return "refused"
    except Exception as exc:
        return _failure("refresh", exc)
    if response.user is None or response.session is None:
        return "refused"
    return _authenticated(response.user, response.session)


def revoke_sessions(access_token: str, scope: Literal["local", "global", "others"] = "local") -> None:
    """End sessions server-side so their refresh tokens stop working. Best effort, never raises.

    `local` ends the session this access token belongs to, `global` every session of its user,
    and `others` every session of its user except this one.
    """
    try:
        db.service_client().auth.admin.sign_out(access_token, scope)
    except Exception:
        log.warning("auth: revoking sessions (scope=%s) failed", scope)


def confirm_email(user_id: str) -> None:
    """Mark the email confirmed in Supabase Auth (we run our own verification). Never raises."""
    try:
        db.service_client().auth.admin.update_user_by_id(user_id, {"email_confirm": True})
    except Exception:
        log.warning("auth: confirming email in Supabase Auth failed user_id=%s", user_id)


def set_password(user_id: str, password: str) -> bool:
    """Replace the account's password. False when Supabase refused or did not answer."""
    try:
        db.service_client().auth.admin.update_user_by_id(user_id, {"password": password})
    except Exception:
        log.exception("auth: setting a password failed user_id=%s", user_id)
        return False
    return True
