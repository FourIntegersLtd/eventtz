"""Request and response bodies for the vendor Growth Co-pilot.

Names and fields match the baseline contracts (`backend/app/contracts/vendor_copilot.py`),
so the generated web types do not change.
"""

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
    """One thing the co-pilot suggests the vendor do next."""

    model_config = ConfigDict(populate_by_name=True)

    action_type: CopilotActionKind = Field(validation_alias="kind")
    title: str
    rationale: str
    action_data: dict[str, Any] = Field(default_factory=dict, validation_alias="payload")
    href: str | None = None


class GrowthScoreLever(BaseModel):
    """One of the five levers behind the Growth Score, with its own sub-score and tip."""

    model_config = ConfigDict(populate_by_name=True)

    metric_key: str = Field(validation_alias="key")
    label: str
    score: int = Field(ge=0, le=100)
    max_score: int = Field(ge=1, le=100)
    status: Literal["good", "ok", "needs_work"]
    tip: str


class GrowthScoreResponse(BaseModel):
    """The vendor's deterministic Growth Score, broken down by lever."""

    score: int = Field(ge=0, le=100)
    levers: list[GrowthScoreLever] = Field(default_factory=list)
    listing_visible: bool = False
    payouts_verified: bool = False


class MarketDemandInsight(BaseModel):
    """A short observation about demand for the vendor's services in their area."""

    headline: str
    detail: str
    service_category: str | None = None


class VendorCopilotBriefResponse(BaseModel):
    """The vendor's daily brief: a greeting, plain-English narration and suggested actions."""

    greeting: str
    summary_markdown: str
    growth_score: int = Field(ge=0, le=100)
    suggested_actions: list[CopilotAction] = Field(default_factory=list)
    demand_insights: list[MarketDemandInsight] = Field(default_factory=list)
    generated_at: datetime
    context_fingerprint: str
    narration_cached: bool = False


class CopilotAskMessage(BaseModel):
    """One earlier turn of the vendor's chat with the co-pilot, as the web app sends it."""

    model_config = ConfigDict(populate_by_name=True)

    message_role: str = Field(description="user or assistant", validation_alias="role")
    content: str


class CopilotAskRequest(BaseModel):
    """A question for the co-pilot, with optional chat history and a booking to focus on."""

    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(min_length=1, max_length=2000)
    history: list[CopilotAskMessage] = Field(default_factory=list, max_length=12)
    booking_request_id: str | None = Field(default=None, validation_alias="booking_id")


class CopilotAskResponse(BaseModel):
    """The co-pilot's answer, plus anything it suggests doing about it."""

    answer_markdown: str
    suggested_actions: list[CopilotAction] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


class CopilotReviewPackagesBody(BaseModel):
    """The vendor's current profile, sent for the post-launch package coach to review."""

    model_config = ConfigDict(populate_by_name=True)

    profile_form_data: dict[str, Any] = Field(default_factory=dict, validation_alias="payload")


class CopilotReviewPackagesResponse(BaseModel):
    """The post-launch package coach's review of the vendor's live packages."""

    overall_ok: bool = True
    summary: str = ""
    package_feedback: list[dict[str, Any]] = Field(default_factory=list)


class CopilotDraftReplyBody(BaseModel):
    """Which booking to draft a reply for, and what kind of reply."""

    model_config = ConfigDict(populate_by_name=True)

    booking_request_id: str = Field(min_length=1, validation_alias="booking_id")
    intent: Literal["accept", "decline", "clarify"] = "accept"


class CopilotDraftReplyResponse(BaseModel):
    """A drafted reply to an enquiry, with tips on what to check before sending it."""

    draft_message: str
    tips: list[str] = Field(default_factory=list)
