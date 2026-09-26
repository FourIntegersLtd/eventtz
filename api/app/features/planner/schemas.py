"""Request/response shapes for the planner and client-events routes.

Plain Pydantic models only - never a `models`/`rows`/`repository` import (see
`tests/guards/test_schemas_are_not_rows.py`), so these can be shared with `web/`'s
generated types without dragging in the database layer.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class CreatePlanRequest(BaseModel):
    """The client's free-text celebration description."""

    prompt: str


class CelebrationBrief(BaseModel):
    """What the planner understood (or guessed) about the celebration, in full."""

    event_type: str
    event_kind: str = "standard"
    location: str | None = None
    related_locations: list[str] = Field(default_factory=list)
    guest_count: int
    budget_gbp: float | None = None
    preferred_date: str | None = None
    preferred_date_invalid: bool = False
    indoor_outdoor: str | None = None
    cuisine_notes: str | None = None
    music_notes: str | None = None
    special_requirements: str | None = None
    excluded_needs: list[str] = Field(default_factory=list)
    currency_assumed_gbp: bool = False
    raw_prompt: str
    unsupported_categories_mentioned: list[str] = Field(default_factory=list)


class Confidence(BaseModel):
    """How sure the planner is in its picks, and why."""

    score: int
    reasons: list[str] = Field(default_factory=list)


class BudgetLine(BaseModel):
    """One need's contribution to the plan's budget."""

    need_id: str
    label: str
    amount_gbp: float
    allocated_gbp: float | None
    assumption: str


class BudgetBreakdown(BaseModel):
    """The full plan budget: one line per costed need, the total, and what is left."""

    lines: list[BudgetLine]
    total_estimated_gbp: float
    remaining_budget_gbp: float | None
    user_budget_gbp: float | None
    over_budget: bool
    assumptions: list[str]


class PlannerVendorCard(BaseModel):
    """A vendor as the planner shows it: enough to decide, never a full profile."""

    user_id: str
    business_name: str
    city: str | None = None
    min_list_price_gbp: float | None = None
    unavailable: bool = False
    price_on_request: bool = False


class PlanRecommendation(BaseModel):
    """One need on the plan: the primary vendor picked for it, and the alternatives kept in reserve."""

    need_id: str
    label: str
    service_key: str
    optional: bool
    primary: PlannerVendorCard | None
    alternatives: list[PlannerVendorCard] = Field(default_factory=list)
    estimated_cost_gbp: float | None
    why_selected: str | None
    empty_reason: str | None = None


class CelebrationSummary(BaseModel):
    """The plan's headline facts, for the top of the detail view."""

    title: str
    event_type: str
    location: str | None
    guest_count: int
    budget_gbp: float | None
    preferred_date: str | None
    summary: str | None


class PlanListItem(BaseModel):
    """One row in the client's plan list."""

    plan_id: str
    title: str
    event_type: str
    location: str | None
    confidence_score: int | None
    status: str
    created_at: str
    updated_at: str


class PlanListResponse(BaseModel):
    """`GET /client/planner/plans`."""

    success: bool = True
    plans: list[PlanListItem]


class PlanDetailResponse(BaseModel):
    """`GET /client/planner/plans/{plan_id}`."""

    success: bool = True
    plan_id: str
    status: str
    client_event_id: str | None
    celebration: CelebrationSummary
    brief: CelebrationBrief
    confidence: Confidence
    budget: BudgetBreakdown
    recommendations: list[PlanRecommendation]
    created_at: str
    updated_at: str


class ArchivePlanResponse(BaseModel):
    """`POST /client/planner/plans/{plan_id}/archive`."""

    success: bool = True
    plan_id: str
    status: str


class EnsureEventResponse(BaseModel):
    """`POST /client/planner/plans/{plan_id}/ensure-event`."""

    success: bool = True
    plan_id: str
    event_id: str
    title: str
    event_date: date
    event_address: str | None
    event_postcode: str | None


class ReplaceItemRequest(BaseModel):
    """An (optional, currently unused) hint for which alternative to try next."""

    vendor_user_id: str | None = None


class ReplaceItemResponse(BaseModel):
    """`POST /client/planner/plans/{plan_id}/items/{need_id}/replace`."""

    success: bool = True
    plan_id: str
    recommendation: PlanRecommendation


class ClientEventSummary(BaseModel):
    """One row in the client's events list."""

    id: str
    title: str
    event_date: str
    event_end_date: str | None
    event_address: str | None
    event_postcode: str | None
    status: str
    booking_count: int
    active_booking_count: int
    updated_at: str


class ClientEventListResponse(BaseModel):
    """`GET /client/events`."""

    success: bool = True
    events: list[ClientEventSummary]


class ClientEventDetail(BaseModel):
    """The full detail shown for one client event."""

    id: str
    title: str
    event_date: str
    event_end_date: str | None
    event_address: str | None
    event_postcode: str | None
    status: str
    booking_count: int
    active_booking_count: int
    created_at: str


class ClientEventDetailResponse(BaseModel):
    """`GET /client/events/{event_id}`."""

    success: bool = True
    event: ClientEventDetail
