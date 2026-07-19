"""Client AI Event Planner HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Body, Request, Response

from app.contracts.planner import (
    ArchivePlanResponse,
    CelebrationPlanListResponse,
    CelebrationPlanResponse,
    CreateCelebrationPlanRequest,
    ReplacePlanItemRequest,
)
from app.features.auth.http.guards import require_client
from app.features.planner import plan_service

router = APIRouter(prefix="/client/planner", tags=["client-planner"])


@router.post("/plans", response_model=CelebrationPlanResponse)
def post_create_plan(
    body: CreateCelebrationPlanRequest,
    request: Request,
    response: Response,
) -> CelebrationPlanResponse:
    user = require_client(request, response)
    return plan_service.generate_plan(str(user.get("id") or ""), body.prompt)


@router.get("/plans", response_model=CelebrationPlanListResponse)
def get_list_plans(request: Request, response: Response) -> CelebrationPlanListResponse:
    user = require_client(request, response)
    return plan_service.list_plans(str(user.get("id") or ""))


@router.get("/plans/{plan_id}", response_model=CelebrationPlanResponse)
def get_plan_detail(
    plan_id: str,
    request: Request,
    response: Response,
) -> CelebrationPlanResponse:
    user = require_client(request, response)
    return plan_service.get_plan(str(user.get("id") or ""), plan_id)


@router.post(
    "/plans/{plan_id}/items/{need_id}/replace",
    response_model=CelebrationPlanResponse,
)
def post_replace_plan_item(
    plan_id: str,
    need_id: str,
    request: Request,
    response: Response,
    body: ReplacePlanItemRequest = Body(default_factory=ReplacePlanItemRequest),
) -> CelebrationPlanResponse:
    user = require_client(request, response)
    return plan_service.replace_plan_item(
        str(user.get("id") or ""),
        plan_id,
        need_id,
        exclude_vendor_user_id=body.exclude_vendor_user_id,
    )


@router.post("/plans/{plan_id}/archive", response_model=ArchivePlanResponse)
def post_archive_plan(
    plan_id: str,
    request: Request,
    response: Response,
) -> ArchivePlanResponse:
    user = require_client(request, response)
    return plan_service.archive_plan(str(user.get("id") or ""), plan_id)
