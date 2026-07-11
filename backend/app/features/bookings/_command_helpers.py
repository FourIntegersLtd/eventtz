"""Shared helpers for booking write operations."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import rows
from app.core.db import get_db as get_client

logger = get_logger(__name__)


def assert_target_user_is_client(client_user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    try:
        res = (
            get_client()
            .table("users")
            .select("id,user_type,account_suspended")
            .eq("id", client_user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("booking_requests: load user type failed")
        raise ValueError("Could not verify client account.") from None
    user_rows = rows(res)
    if not user_rows:
        raise ValueError("Client not found.")
    r0 = user_rows[0]
    if str(r0.get("user_type") or "") != "client":
        raise ValueError("Quotes can only be sent to a client account.")
    if bool(r0.get("account_suspended")):
        raise ValueError("This client account is suspended.")


def normalize_event_postcode_accept(v: str | None) -> str | None:
    if v is None:
        return None
    s = " ".join(v.strip().split())
    return s if len(s) >= 2 else None
