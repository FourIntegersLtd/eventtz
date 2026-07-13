"""Client first-visit onboarding endpoints (preferred name + completion flag)."""

from fastapi import APIRouter, Request, Response

from app.contracts.user_settings import (
    ClientOnboardingPatchBody,
    ClientOnboardingResponse,
    ClientOnboardingState,
)
from app.features.auth.http.guards import require_client
from app.features.settings.client_onboarding import (
    get_client_onboarding,
    update_client_onboarding,
)

router = APIRouter(prefix="/client", tags=["client"])


def _to_state(raw: dict) -> ClientOnboardingState:
    return ClientOnboardingState(
        completed=bool(raw.get("completed", False)),
        preferred_name=raw.get("preferred_name"),
    )


@router.get("/onboarding", response_model=ClientOnboardingResponse)
def get_onboarding(request: Request, response: Response) -> ClientOnboardingResponse:
    user = require_client(request, response)
    raw = get_client_onboarding(str(user.get("id") or ""))
    return ClientOnboardingResponse(onboarding=_to_state(raw))


@router.patch("/onboarding", response_model=ClientOnboardingResponse)
def patch_onboarding(
    request: Request,
    response: Response,
    body: ClientOnboardingPatchBody,
) -> ClientOnboardingResponse:
    user = require_client(request, response)
    raw = update_client_onboarding(
        str(user.get("id") or ""),
        preferred_name=body.preferred_name,
        mark_completed=bool(body.mark_completed),
    )
    return ClientOnboardingResponse(onboarding=_to_state(raw))
