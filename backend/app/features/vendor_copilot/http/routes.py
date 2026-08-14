"""Vendor Growth Co-pilot HTTP routes."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.contracts.vendor_copilot import (
    CopilotAskRequest,
    CopilotAskResponse,
    CopilotDraftReplyBody,
    CopilotDraftReplyResponse,
    CopilotReviewPackagesBody,
    CopilotReviewPackagesResponse,
    GrowthScoreLever,
    GrowthScoreResponse,
    VendorCopilotBriefResponse,
)
from app.core.logging import get_logger
from app.features.auth.http.dependencies import require_vendor_dep
from app.features.vendor_copilot.assistant import ask_copilot
from app.features.vendor_copilot.brief import build_daily_brief
from app.features.vendor_copilot.context import build_vendor_context
from app.features.vendor_copilot.optimizer import review_listing_packages
from app.features.vendor_copilot.reply_coach import draft_enquiry_reply
from app.features.vendor_copilot.score import compute_growth_score

logger = get_logger(__name__)

router = APIRouter(prefix="/vendor/copilot", tags=["vendor-copilot"])


@router.get("/score", response_model=GrowthScoreResponse)
def get_growth_score(
    vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> GrowthScoreResponse:
    uid = str(vendor.get("id") or "")
    ctx = build_vendor_context(uid)
    if not ctx.get("found"):
        return GrowthScoreResponse(score=0, levers=[], listing_visible=False, payouts_verified=False)

    payload = ctx.get("payload")
    if not isinstance(payload, dict):
        payload = {}

    data = compute_growth_score(
        payload=payload,
        listing_visible=bool(ctx.get("listing_visible")),
        payouts_verified=bool(ctx.get("payouts_verified")),
        analytics_overview=ctx.get("analytics_overview") if isinstance(ctx.get("analytics_overview"), dict) else {},
    )
    return GrowthScoreResponse(
        score=int(data["score"]),
        levers=[GrowthScoreLever(**lev) for lev in data["levers"]],
        listing_visible=bool(data.get("listing_visible")),
        payouts_verified=bool(data.get("payouts_verified")),
    )


@router.get("/brief", response_model=VendorCopilotBriefResponse)
def get_daily_brief(
    vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> VendorCopilotBriefResponse:
    uid = str(vendor.get("id") or "")
    try:
        return build_daily_brief(uid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("vendor_copilot brief failed user=%s", uid)
        raise HTTPException(
            status_code=503,
            detail="Growth brief is unavailable right now. Please try again later.",
        ) from e


@router.post("/ask", response_model=CopilotAskResponse)
def post_copilot_ask(
    body: CopilotAskRequest,
    vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> CopilotAskResponse:
    uid = str(vendor.get("id") or "")
    q = (body.question or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question is required.")
    try:
        return ask_copilot(
            vendor_user_id=uid,
            question=q,
            history=body.history,
            booking_id=body.booking_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("vendor_copilot ask failed user=%s", uid)
        raise HTTPException(
            status_code=503,
            detail="Abba is unavailable right now. Please try again later.",
        ) from e


@router.post("/review-packages", response_model=CopilotReviewPackagesResponse)
def post_review_listing_packages(
    body: CopilotReviewPackagesBody,
    vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> CopilotReviewPackagesResponse:
    _ = vendor
    result = review_listing_packages(payload=dict(body.payload or {}))
    return CopilotReviewPackagesResponse(
        overall_ok=bool(result.get("overall_ok", True)),
        summary=str(result.get("summary") or ""),
        package_feedback=list(result.get("package_feedback") or []),
    )


@router.post("/draft-reply", response_model=CopilotDraftReplyResponse)
def post_draft_reply(
    body: CopilotDraftReplyBody,
    vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> CopilotDraftReplyResponse:
    uid = str(vendor.get("id") or "")
    try:
        result = draft_enquiry_reply(
            vendor_user_id=uid,
            booking_id=body.booking_id.strip(),
            intent=body.intent,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("vendor_copilot draft-reply failed user=%s booking=%s", uid, body.booking_id)
        raise HTTPException(
            status_code=503,
            detail="Could not draft a reply right now. Please try again later.",
        ) from e
    return CopilotDraftReplyResponse(
        draft_message=str(result.get("draft_message") or ""),
        tips=list(result.get("tips") or []),
    )
