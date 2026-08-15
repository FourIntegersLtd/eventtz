"""Vendor Growth Co-pilot API contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


CopilotActionKind = Literal[
    "edit_profile",
    "open_booking",
    "open_payments",
    "open_analytics",
    "open_messages",
    "apply_package_patch",
]


class CopilotAction(BaseModel):
    action_type: CopilotActionKind = Field(validation_alias="kind")
    title: str
    rationale: str
    action_data: dict[str, Any] = Field(default_factory=dict, validation_alias="payload")
    href: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class GrowthScoreLever(BaseModel):
    metric_key: str = Field(validation_alias="key")
    label: str
    score: int = Field(ge=0, le=100)
    max_score: int = Field(ge=1, le=100)
    status: Literal["good", "ok", "needs_work"]
    tip: str

    model_config = ConfigDict(populate_by_name=True)


class GrowthScoreResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    levers: list[GrowthScoreLever] = Field(default_factory=list)
    listing_visible: bool = False
    payouts_verified: bool = False


class MarketDemandInsight(BaseModel):
    headline: str
    detail: str
    service_category: str | None = None


class VendorCopilotBriefResponse(BaseModel):
    greeting: str
    summary_markdown: str
    growth_score: int = Field(ge=0, le=100)
    suggested_actions: list[CopilotAction] = Field(default_factory=list)
    demand_insights: list[MarketDemandInsight] = Field(default_factory=list)
    generated_at: datetime
    context_fingerprint: str
    narration_cached: bool = False


class CopilotAskMessage(BaseModel):
    message_role: str = Field(description="user or assistant", validation_alias="role")
    content: str

    model_config = ConfigDict(populate_by_name=True)


class CopilotAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[CopilotAskMessage] = Field(default_factory=list, max_length=12)
    booking_request_id: str | None = Field(default=None, validation_alias="booking_id")

    model_config = ConfigDict(populate_by_name=True)


class CopilotAskResponse(BaseModel):
    answer_markdown: str
    suggested_actions: list[CopilotAction] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


class CopilotReviewPackagesBody(BaseModel):
    profile_form_data: dict[str, Any] = Field(default_factory=dict, validation_alias="payload")

    model_config = ConfigDict(populate_by_name=True)


class CopilotReviewPackagesResponse(BaseModel):
    overall_ok: bool = True
    summary: str = ""
    package_feedback: list[dict[str, Any]] = Field(default_factory=list)


class CopilotDraftReplyBody(BaseModel):
    booking_request_id: str = Field(min_length=1, validation_alias="booking_id")
    intent: Literal["accept", "decline", "clarify"] = "accept"

    model_config = ConfigDict(populate_by_name=True)


class CopilotDraftReplyResponse(BaseModel):
    draft_message: str
    tips: list[str] = Field(default_factory=list)
