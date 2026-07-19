"""AI Event Planner API contracts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateCelebrationPlanRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)


class CelebrationBrief(BaseModel):
    event_type: str | None = None
    event_kind: Literal["funeral", "corporate", "standard"] = "standard"
    location: str | None = None
    related_locations: list[str] = Field(default_factory=list)
    guest_count: int | None = None
    budget_gbp: float | None = None
    preferred_date: str | None = None
    preferred_date_invalid: bool = False
    indoor_outdoor: str | None = None
    cuisine_notes: str | None = None
    music_notes: str | None = None
    special_requirements: str | None = None
    excluded_needs: list[str] = Field(default_factory=list)
    currency_assumed_gbp: bool = False
    raw_prompt: str = ""
    unsupported_categories_mentioned: list[str] = Field(default_factory=list)


class PlannerVendorCard(BaseModel):
    user_id: str
    business_name: str = ""
    services: list[str] = Field(default_factory=list)
    review_average: float | None = None
    review_count: int = 0
    completed_bookings: int = 0
    avg_response_seconds: float | None = None
    conversion_rate: float | None = None
    min_list_price_gbp: float | None = None
    base_city: str | None = None
    cover_image_url: str | None = None
    unavailable: bool = False
    price_on_request: bool = False


class PlannerRecommendation(BaseModel):
    need_id: str
    label: str
    service_key: str
    optional: bool = False
    primary: PlannerVendorCard | None = None
    alternatives: list[PlannerVendorCard] = Field(default_factory=list)
    estimated_cost_gbp: float | None = None
    cost_assumption: str | None = Field(
        default=None,
        description="How estimated_cost_gbp was derived for this recommendation.",
    )
    why_selected: str = ""
    empty_reason: str | None = None
    score_breakdown: dict[str, Any] | None = None


class BudgetLine(BaseModel):
    need_id: str
    label: str
    amount_gbp: float
    allocated_gbp: float | None = None
    assumption: str | None = Field(
        default=None,
        description="How this line amount was derived (list price vs template estimate).",
    )


class BudgetBreakdown(BaseModel):
    lines: list[BudgetLine] = Field(default_factory=list)
    total_estimated_gbp: float | None = None
    remaining_budget_gbp: float | None = None
    user_budget_gbp: float | None = None
    over_budget: bool = False
    assumptions: list[str] = Field(
        default_factory=list,
        description="Overall notes so clients understand budget assumptions.",
    )


class ConfidenceBlock(BaseModel):
    score: int = Field(ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)


class CelebrationSummary(BaseModel):
    title: str
    event_type: str | None = None
    location: str | None = None
    guest_count: int | None = None
    budget_gbp: float | None = None
    preferred_date: str | None = None
    summary: str = ""


class CelebrationPlanResponse(BaseModel):
    success: bool = True
    plan_id: str
    status: str = "active"
    celebration: CelebrationSummary
    brief: CelebrationBrief
    confidence: ConfidenceBlock
    budget: BudgetBreakdown
    recommendations: list[PlannerRecommendation] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class CelebrationPlanListItem(BaseModel):
    plan_id: str
    title: str
    event_type: str | None = None
    location: str | None = None
    confidence_score: int | None = None
    status: str = "active"
    created_at: str | None = None
    updated_at: str | None = None


class CelebrationPlanListResponse(BaseModel):
    success: bool = True
    plans: list[CelebrationPlanListItem] = Field(default_factory=list)


class ReplacePlanItemRequest(BaseModel):
    exclude_vendor_user_id: str | None = None


class ArchivePlanResponse(BaseModel):
    success: bool = True
    plan_id: str
    status: str = "archived"
