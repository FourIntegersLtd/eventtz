"""Typed rows the planner repository returns, in plain values (text ids, ISO dates)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


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


class CelebrationPlanItemRow(BaseModel):
    """A `celebration_plan_items` row."""

    id: str
    plan_id: str
    need_id: str
    label: str
    service_key: str
    optional: bool = False
    primary_vendor_user_id: str | None = None
    alternative_vendor_user_ids: list[str] = Field(default_factory=list)
    estimated_cost_gbp: float | None = None
    why_selected: str | None = None
    score_breakdown: dict[str, Any] | None = None
    sort_order: int = 0


class CelebrationPlanRow(BaseModel):
    """A `celebration_plans` row, without its items."""

    id: str
    client_user_id: str
    title: str
    raw_prompt: str
    brief: dict[str, Any] = Field(default_factory=dict)
    confidence_score: int | None = None
    confidence_reasons: list[Any] | None = None
    summary: str | None = None
    budget_total_gbp: float | None = None
    budget_remaining_gbp: float | None = None
    currency: str = "GBP"
    status: str = "active"
    client_event_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CelebrationPlanWithItemsRow(BaseModel):
    """A plan and the items recommended within it, ordered by `sort_order`."""

    plan: CelebrationPlanRow
    items: list[CelebrationPlanItemRow] = Field(default_factory=list)
