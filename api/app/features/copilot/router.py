"""Vendor Growth Co-pilot routes: ask, brief, draft-reply, review-packages, score."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import (
    LanguageModelDependency,
    LanguageModelEmptyReply,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelUnavailable,
)
from app.features.copilot import (
    schemas,
    service_ask,
    service_brief,
    service_packages,
    service_reply,
    service_score,
)
from app.features.copilot.errors import QuestionRequired

router = APIRouter(prefix="/vendor/copilot", tags=["vendor-copilot"])

# Every LLM-backed route here can fail the same three ways.
_AI_ERRORS = (
    *ROLE_ERRORS,
    LanguageModelUnavailable,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelEmptyReply,
)


@router.get("/score", response_model=schemas.GrowthScoreResponse, responses=error_responses(*ROLE_ERRORS))
async def get_growth_score(principal: CurrentVendor, session: SessionDep) -> schemas.GrowthScoreResponse:
    """The vendor's deterministic Growth Score: no language model involved."""
    return await service_score.get_growth_score(session, principal)


@router.get(
    "/brief",
    response_model=schemas.VendorCopilotBriefResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_daily_brief(
    principal: CurrentVendor,
    session: SessionDep,
    language_model: LanguageModelDependency,
) -> schemas.VendorCopilotBriefResponse:
    """The vendor's daily brief: a Growth Score, suggested actions and a plain-English summary.

    Never raises on a language-model failure: `service_brief` catches it and falls back to
    a fixed summary instead.
    """
    return await service_brief.build_daily_brief(session, principal, language_model=language_model)


@router.post(
    "/ask",
    response_model=schemas.CopilotAskResponse,
    responses=error_responses(*ROLE_ERRORS, QuestionRequired, *_AI_ERRORS),
)
async def post_ask_copilot(
    principal: CurrentVendor,
    session: SessionDep,
    body: schemas.CopilotAskRequest,
    language_model: LanguageModelDependency,
) -> schemas.CopilotAskResponse:
    """Ask the co-pilot a question, grounded in the vendor's own facts."""
    return await service_ask.ask_copilot(
        session,
        principal,
        question=body.question,
        history=body.history,
        booking_request_id=body.booking_request_id,
        language_model=language_model,
    )


@router.post(
    "/draft-reply",
    response_model=schemas.CopilotDraftReplyResponse,
    responses=error_responses(*_AI_ERRORS),
)
async def post_draft_reply(
    principal: CurrentVendor,
    session: SessionDep,
    body: schemas.CopilotDraftReplyBody,
    language_model: LanguageModelDependency,
) -> schemas.CopilotDraftReplyResponse:
    """Draft a reply to one of the vendor's enquiries, or a fixed placeholder if not found."""
    return await service_reply.draft_enquiry_reply(
        session,
        principal,
        booking_request_id=body.booking_request_id.strip(),
        intent=body.intent,
        language_model=language_model,
    )


@router.post(
    "/review-packages",
    response_model=schemas.CopilotReviewPackagesResponse,
    responses=error_responses(*_AI_ERRORS),
)
async def post_review_listing_packages(
    principal: CurrentVendor,
    body: schemas.CopilotReviewPackagesBody,
    language_model: LanguageModelDependency,
) -> schemas.CopilotReviewPackagesResponse:
    """Coach the vendor on their live packages, post-launch conversion focus."""
    del principal  # packages are reviewed from the submitted form data only, not stored profile state
    return await service_packages.review_listing_packages(
        payload=body.profile_form_data, language_model=language_model
    )
