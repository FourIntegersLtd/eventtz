"""Shared dispute case creation (admin console and participant flows)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client

logger = get_logger(__name__)


def create_dispute_case(
    *,
    booking_request_id: str,
    opened_by_user_id: str,
    summary: str,
    conversation_id: str | None = None,
) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    row: dict[str, Any] = {
        "booking_request_id": booking_request_id,
        "opened_by_user_id": opened_by_user_id,
        "summary": summary.strip(),
        "status": "open",
    }
    if conversation_id:
        row["conversation_id"] = conversation_id
    try:
        ins = get_client().table("dispute_cases").insert(row).execute()
        data = getattr(ins, "data", None) or []
        if not data:
            return None
        d = data[0] if isinstance(data, list) else data
        return d if isinstance(d, dict) else None
    except Exception as e:
        logger.warning("create_dispute_case failed: %s", e, exc_info=True)
        return None
