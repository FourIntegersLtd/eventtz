"""Client-owned celebrations that group multi-vendor booking requests."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ClientEventSummary(BaseModel):
    id: str
    title: str
    event_date: str
    event_end_date: str | None = None
    event_address: str | None = None
    event_postcode: str | None = None
    status: Literal["active", "archived"] = "active"
    booking_count: int = 0
    active_booking_count: int = 0
    updated_at: str | None = None


class ClientEventsListResponse(BaseModel):
    success: bool = True
    events: list[ClientEventSummary]


class ClientEventDetail(BaseModel):
    id: str
    title: str
    event_date: str
    event_end_date: str | None = None
    event_address: str | None = None
    event_postcode: str | None = None
    status: Literal["active", "archived"] = "active"
    booking_count: int = 0
    active_booking_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class ClientEventDetailResponse(BaseModel):
    success: bool = True
    event: ClientEventDetail
