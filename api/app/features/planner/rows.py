"""Typed rows the planner repository returns, in plain values (text ids, ISO dates)."""

from __future__ import annotations

from pydantic import BaseModel


class ClientEventRow(BaseModel):
    """A `client_events` row."""

    id: str
    client_user_id: str
    title: str
    event_date: str
    event_end_date: str | None = None
    event_address: str | None = None
    event_postcode: str | None = None
    status: str = "active"
    created_at: str | None = None
    updated_at: str | None = None
