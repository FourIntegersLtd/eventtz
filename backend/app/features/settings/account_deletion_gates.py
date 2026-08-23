"""Deletion refusal checks: password, money in flight, active bookings, disputes."""

from __future__ import annotations

from typing import Any

from app.core.db import get_db, rows_from_query_result
from app.core.errors import ConflictError, ValidationError
from app.core.logging import get_logger
from app.features.auth import messages as auth_messages
from app.features.auth.supabase import SupabaseAuthService
from app.features.bookings.completion_rules import event_day_over
from app.features.settings import messages as settings_messages

logger = get_logger(__name__)

_MONEY_IN_FLIGHT = frozenset({"pending", "paid"})
_OPEN_DISPUTE = frozenset({"open", "under_review"})


def assert_password(email: str, password: str) -> None:
    if not email or "@" not in email:
        raise ValidationError(auth_messages.CURRENT_PASSWORD_INCORRECT)
    result = SupabaseAuthService().sign_in_with_password(email=email, password=password)
    if not result.get("success"):
        raise ValidationError(auth_messages.CURRENT_PASSWORD_INCORRECT)


def assert_can_delete(user_id: str) -> None:
    bookings = bookings_for_user(user_id)
    for row in bookings:
        pay = str(row.get("payment_status") or "")
        if pay in _MONEY_IN_FLIGHT:
            raise ConflictError(
                settings_messages.ACCOUNT_DELETE_MONEY,
                code=settings_messages.CODE_MONEY_IN_FLIGHT,
            )
        status = str(row.get("status") or "")
        if status == "accepted" and not event_day_over(row):
            raise ConflictError(
                settings_messages.ACCOUNT_DELETE_ACTIVE,
                code=settings_messages.CODE_ACTIVE_BOOKING,
            )
    if has_open_dispute(user_id, bookings):
        raise ConflictError(
            settings_messages.ACCOUNT_DELETE_DISPUTE,
            code=settings_messages.CODE_OPEN_DISPUTE,
        )


def bookings_for_user(user_id: str) -> list[dict[str, Any]]:
    cols = (
        "id,status,payment_status,event_date,event_end_date,"
        "client_user_id,vendor_user_id"
    )
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for column in ("client_user_id", "vendor_user_id"):
        try:
            res = (
                get_db()
                .table("booking_requests")
                .select(cols)
                .eq(column, user_id)
                .execute()
            )
        except Exception:
            logger.exception("account_deletion: list bookings %s failed user=%s", column, user_id)
            continue
        for row in rows_from_query_result(res):
            bid = str(row.get("id") or "")
            if bid and bid not in seen:
                seen.add(bid)
                out.append(row)
    return out


def has_open_dispute(user_id: str, bookings: list[dict[str, Any]]) -> bool:
    booking_ids = [str(r.get("id") or "") for r in bookings if r.get("id")]
    db = get_db()
    try:
        q = (
            db.table("dispute_cases")
            .select("id")
            .eq("opened_by_user_id", user_id)
            .in_("status", list(_OPEN_DISPUTE))
            .limit(1)
            .execute()
        )
        if rows_from_query_result(q):
            return True
    except Exception:
        logger.exception("account_deletion: open disputes by opener failed user=%s", user_id)
    if not booking_ids:
        return False
    try:
        q = (
            db.table("dispute_cases")
            .select("id")
            .in_("booking_request_id", booking_ids)
            .in_("status", list(_OPEN_DISPUTE))
            .limit(1)
            .execute()
        )
        return bool(rows_from_query_result(q))
    except Exception:
        logger.exception("account_deletion: open disputes by booking failed user=%s", user_id)
        return False
