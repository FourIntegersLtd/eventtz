"""Identity use cases other slices call: naming users on screens that must not show emails."""

from __future__ import annotations

from app.features.identity import repository
from app.features.identity.domain import client_display_name


def client_display_names(user_ids: list[str]) -> dict[str, str]:
    """Map each existing user id to the name a vendor sees for that client. Unknown ids are left out."""
    return {
        user.id: client_display_name(
            email=user.email, preferred_name=user.preferred_name, deleted=bool(user.deleted_at)
        )
        for user in repository.list_user_summaries(user_ids)
    }


def emails_by_id(user_ids: list[str]) -> dict[str, str | None]:
    """Map each existing user id to their email (for staff screens). Unknown ids are left out."""
    return {user.id: user.email for user in repository.list_user_summaries(user_ids)}
