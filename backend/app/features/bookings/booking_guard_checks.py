"""Shared checks used when creating or updating bookings."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import rows_from_query_result
from app.core.db import get_db
from app.features.bookings import messages as booking_messages

logger = get_logger(__name__)


def assert_target_user_is_client(client_user_id: str) -> None:
    try:
        res = (
            get_db()
            .table("users")
            .select("id,user_type,account_suspended")
            .eq("id", client_user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("booking_requests: load user type failed")
        raise ValueError(booking_messages.COULD_NOT_VERIFY_CLIENT) from None
    user_rows = rows_from_query_result(res)
    if not user_rows:
        raise ValueError(booking_messages.CLIENT_NOT_FOUND)
    r0 = user_rows[0]
    if str(r0.get("user_type") or "") != "client":
        raise ValueError(booking_messages.QUOTES_CLIENT_ONLY)
    if bool(r0.get("account_suspended")):
        raise ValueError(booking_messages.CLIENT_SUSPENDED)


def normalize_event_postcode_accept(v: str | None) -> str | None:
    if v is None:
        return None
    s = " ".join(v.strip().split())
    return s if len(s) >= 2 else None
