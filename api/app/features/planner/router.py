"""Client routes: the AI Event Planner (plans) and the client events they link to."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import LanguageModelDependency
from app.features.planner import errors, service_client_events, service_plans
from app.features.planner.schemas import (
    ArchivePlanResponse,
    ClientEventDetailResponse,
    ClientEventListResponse,
    CreatePlanRequest,
    EnsureEventResponse,
    PlanDetailResponse,
    PlanListResponse,
    ReplaceItemRequest,
    ReplaceItemResponse,
)

router = APIRouter(tags=["client"])

_STATUS_QUERY = Query("active", description="Filter bucket: active, archived, or all")


@router.post(
    "/client/planner/plans",
    response_model=PlanDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS, errors.DescribeCelebration, errors.InvalidPrompt, errors.SimpleIntent
    ),
)
async def create_plan(
    session: SessionDep,
    client: CurrentClient,
    body: CreatePlanRequest,
    language_model: LanguageModelDependency,
) -> PlanDetailResponse:
    """Turn a free-text celebration prompt into a vendor-backed plan."""
    return await service_plans.generate_plan(session, client.id, body.prompt, language_model=language_model)


@router.get(
    "/client/planner/plans",
    response_model=PlanListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_plans(session: SessionDep, client: CurrentClient) -> PlanListResponse:
    """The client's own active plans, most recently updated first."""
    return await service_plans.list_plans(session, client.id)


@router.get(
    "/client/planner/plans/{plan_id}",
    response_model=PlanDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.PlanNotFound),
)
async def get_plan(session: SessionDep, client: CurrentClient, plan_id: str) -> PlanDetailResponse:
    """One plan in full: its brief, budget and vendor recommendations."""
    return await service_plans.get_plan_detail(session, client.id, plan_id)


@router.post(
    "/client/planner/plans/{plan_id}/archive",
    response_model=ArchivePlanResponse,
    responses=error_responses(*ROLE_ERRORS, errors.PlanNotFound),
)
async def archive_plan(session: SessionDep, client: CurrentClient, plan_id: str) -> ArchivePlanResponse:
    """Archive a plan: it stops appearing in the list but its detail stays readable."""
    return await service_plans.archive_plan(session, client.id, plan_id)


@router.post(
    "/client/planner/plans/{plan_id}/ensure-event",
    response_model=EnsureEventResponse,
    responses=error_responses(*ROLE_ERRORS, errors.PlanNotFound, errors.PlanArchived),
)
async def ensure_plan_event(session: SessionDep, client: CurrentClient, plan_id: str) -> EnsureEventResponse:
    """Turn a plan into a real client event, reusing one already linked instead of duplicating it."""
    return await service_plans.ensure_client_event_for_plan(session, client.id, plan_id)


@router.post(
    "/client/planner/plans/{plan_id}/items/{need_id}/replace",
    response_model=ReplaceItemResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.PlanNotFound,
        errors.PlanArchived,
        errors.PlanItemNotFound,
        errors.NoMoreAlternatives,
    ),
)
async def replace_plan_item(
    session: SessionDep,
    client: CurrentClient,
    plan_id: str,
    need_id: str,
    body: ReplaceItemRequest,
    language_model: LanguageModelDependency,
) -> ReplaceItemResponse:
    """Swap a need's primary vendor for the next-best untried candidate."""
    del body  # reserved for a future "try this vendor" hint; unused for now
    return await service_plans.replace_plan_item(
        session, client.id, plan_id, need_id, language_model=language_model
    )


@router.get(
    "/client/events",
    response_model=ClientEventListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidStatusFilter),
)
async def list_client_events(
    session: SessionDep, client: CurrentClient, status: str = _STATUS_QUERY
) -> ClientEventListResponse:
    """The client's own events, scoped by status (active, archived or all)."""
    return await service_client_events.list_client_events(session, client.id, status=status)


@router.get(
    "/client/events/{event_id}",
    response_model=ClientEventDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidEventId, errors.ClientEventNotFound),
)
async def get_client_event(
    session: SessionDep, client: CurrentClient, event_id: str
) -> ClientEventDetailResponse:
    """One of the client's own events, in full."""
    return await service_client_events.get_client_event(session, client.id, event_id)
