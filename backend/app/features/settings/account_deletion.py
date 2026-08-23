"""Self-service account deletion (UK GDPR Art. 17).

Hard invariants: never DELETE public.users, booking_requests, DM conversations,
the vendors row, or any other user's auth/profile row. Tombstone + UPDATE only.
"""

from __future__ import annotations

from app.core.db import get_db
from app.core.errors import ForbiddenError, ValidationError
from app.core.logging import get_logger
from app.features.analytics.mixpanel import delete_mixpanel_profile
from app.features.auth import messages as auth_messages
from app.features.auth.accounts import fetch_user_profile, profile_is_deleted
from app.features.email.dispatch import send_account_deleted_email
from app.features.settings import messages as settings_messages
from app.features.settings.account_deletion_erase import (
    cancel_unpaid_pending,
    erase_owned_data,
    tombstone_user,
    vendor_stripe_account_id,
    wipe_vendor_if_any,
)
from app.features.settings.account_deletion_gates import assert_can_delete, assert_password

logger = get_logger(__name__)


def delete_own_account(*, user_id: str, password: str) -> None:
    """Close a client or vendor account. Raises AppError on refusal."""
    uid = str(user_id or "").strip()
    if not uid:
        raise ValidationError(auth_messages.SIGN_IN_REQUIRED)

    profile = fetch_user_profile(uid)
    if not profile:
        raise ValidationError(auth_messages.SIGN_IN_REQUIRED)
    if str(profile.get("user_type") or "") == "admin":
        raise ForbiddenError(settings_messages.ACCOUNT_DELETE_ADMIN)
    if profile_is_deleted(profile):
        _delete_auth_user(uid)
        return

    email = str(profile.get("email") or "").strip().lower()
    assert_password(email, password)
    assert_can_delete(uid)

    send_account_deleted_email(email=email)
    stripe_account_id = vendor_stripe_account_id(uid)
    cancel_unpaid_pending(uid)
    erase_owned_data(uid)
    tombstone_user(uid)
    wipe_vendor_if_any(uid)
    _best_effort_processors(uid, stripe_account_id=stripe_account_id)
    _delete_auth_user(uid)
    logger.info("account deleted user_id=%s", uid)


def _best_effort_processors(user_id: str, *, stripe_account_id: str | None) -> None:
    if stripe_account_id:
        try:
            from app.features.payments.stripe import delete_connect_account

            delete_connect_account(stripe_account_id)
        except Exception:
            logger.warning("account_deletion: Stripe Connect cleanup failed user=%s", user_id)
    delete_mixpanel_profile(user_id)


def _delete_auth_user(user_id: str) -> None:
    try:
        get_db().auth.admin.delete_user(user_id)
    except Exception:
        logger.warning("account_deletion: auth delete failed user=%s", user_id)
