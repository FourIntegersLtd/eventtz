"""Database access for user accounts. The only file in this slice that queries."""

from __future__ import annotations

from app.core import db
from app.features.identity.models import UserSummaryRow


def list_user_summaries(user_ids: list[str]) -> list[UserSummaryRow]:
    """The named users that exist (unknown ids are simply absent), in one query."""
    unique_ids = sorted({user_id.strip() for user_id in user_ids if user_id and user_id.strip()})
    if not unique_ids:
        return []
    result = (
        db.service_client()
        .table("users")
        .select("id,email,preferred_name,deleted_at")
        .in_("id", unique_ids)
        .execute()
    )
    return [UserSummaryRow.model_validate(row) for row in db.rows(result)]
