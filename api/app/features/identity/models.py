"""Typed rows the identity repository returns. Only the repository builds them; schemas never import them."""

from __future__ import annotations

from pydantic import BaseModel


class UserSummaryRow(BaseModel):
    """The few `users` columns other slices need to name someone."""

    id: str
    email: str | None = None
    preferred_name: str | None = None
    deleted_at: str | None = None
