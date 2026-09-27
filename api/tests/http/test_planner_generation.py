"""The AI Event Planner's happy path, end to end over HTTP.

`acceptance/test_planner.py` cannot exercise a successful plan generation or
item replace: the acceptance harness starts the api process itself, with no
way to inject a fake language model into it, and without a reachable OpenAI
client the token-only classifier always answers `mode="simple"` (see that
file's module docstring). These two paths are instead proved here, against
the same migrated Postgres the acceptance suite uses, with
`tests.support.fakes.FakeLanguageModel` injected through
`app.dependency_overrides` (never `patch("app.…")`).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.ports import language_model_port
from app.core.settings import get_settings
from app.features.identity import repository as identity_repository
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeLanguageModel

pytestmark = [pytest.mark.db, pytest.mark.e2e]

VENDOR_BUSINESS_NAME = "Test City Hair Studio"
VENDOR_CITY = "Test City"
VENDOR_PRICE_GBP = 300.0

# One reply dict satisfies every reply model the planner validates a fake
# language-model reply against in one request: `ModelQueryParse` (marketplace's
# intent classifier), `_BriefReply` (the planner's own brief extraction) and
# `_WhyReply` ("why this vendor"). Pydantic's `model_validate` ignores the
# fields each particular model does not declare.
FAKE_REPLY = {
    "mode": "plan",
    "event_type": "birthdays",
    "location": VENDOR_CITY,
    "guest_count": 50,
    "budget_gbp": 900.0,
    "why": "A great pick for your celebration.",
}


async def _make_account(session: AsyncSession, *, email: str, user_type: str) -> tuple[str, str]:
    """A real `users` row plus a Bearer token naming it (id, token)."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None, f"an account with {email} already exists in this test"
    token = issue_access_token(user_id=account_id, email=email, settings=get_settings())
    return account_id, token


async def _seed_listed_vendor(
    session: AsyncSession, *, email: str, business_name: str = VENDOR_BUSINESS_NAME
) -> str:
    """An approved, publicly listed hair-styling vendor, ranked by the planner."""
    vendor_id, _token = await _make_account(session, email=email, user_type="vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "approval_status": "approved",
            "listing_override": "visible",
            "services_offered": ["hair_styling"],
            "base_city_normalized": VENDOR_CITY.lower(),
            "min_list_price_gbp": VENDOR_PRICE_GBP,
            "country_code": "GB",
            "payload": {
                "businessName": business_name,
                "servicesOffered": ["hair_styling"],
                "baseCity": VENDOR_CITY,
                "min_list_price_gbp": VENDOR_PRICE_GBP,
            },
        },
        exists=False,
    )
    assert saved, "the vendor's business name must not clash in this test"
    return vendor_id


@pytest.fixture
def fake_language_model(app: FastAPI) -> FakeLanguageModel:
    """The fake every planner call in this file resolves through."""
    fake = FakeLanguageModel(reply=FAKE_REPLY)
    app.dependency_overrides[language_model_port] = lambda: fake
    return fake


async def test_generate_plan_recommends_a_listed_vendor_for_a_need(
    client: AsyncClient, db_session: AsyncSession, fake_language_model: FakeLanguageModel
) -> None:
    """A celebration prompt becomes a plan with a real vendor recommended for hair styling."""
    await _seed_listed_vendor(db_session, email="vendor-for-plan@example.com")
    _client_id, token = await _make_account(
        db_session, email="client-for-plan@example.com", user_type="client"
    )

    response = await client.post(
        "/api/v1/client/planner/plans",
        json={"prompt": f"Birthday party for 50 guests in {VENDOR_CITY}, budget 900"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "active"
    assert body["celebration"]["event_type"] == "birthdays"
    hair_recommendations = [
        recommendation
        for recommendation in body["recommendations"]
        if recommendation["service_key"] == "hair_styling"
    ]
    assert len(hair_recommendations) == 1
    primary = hair_recommendations[0]["primary"]
    assert primary is not None
    assert primary["business_name"] == VENDOR_BUSINESS_NAME
    assert primary["unavailable"] is False
    # A budget was stated, so the list ends with the profile step then the budget step.
    assert body["next_steps"][-2:] == [
        "Open a vendor profile to request a booking - nothing is booked until you confirm.",
        "Compare estimated costs against your budget before enquiring.",
    ]
    assert fake_language_model.calls, "the planner must go through the LanguageModel port, not skip it"


async def test_replace_plan_item_swaps_in_the_next_alternative(
    client: AsyncClient, db_session: AsyncSession, fake_language_model: FakeLanguageModel
) -> None:
    """Asking for the next alternative on a need swaps its primary vendor for another listed one."""
    # Four candidates: the create call already shows a primary plus up to two
    # alternatives (three shown in total), so a fourth is needed for the replace
    # call to have anywhere left to go.
    await _seed_listed_vendor(
        db_session, email="vendor-one@example.com", business_name="Test City Hair Studio One"
    )
    await _seed_listed_vendor(
        db_session, email="vendor-two@example.com", business_name="Test City Hair Studio Two"
    )
    await _seed_listed_vendor(
        db_session, email="vendor-three@example.com", business_name="Test City Hair Studio Three"
    )
    await _seed_listed_vendor(
        db_session, email="vendor-four@example.com", business_name="Test City Hair Studio Four"
    )
    _client_id, token = await _make_account(
        db_session, email="client-for-replace@example.com", user_type="client"
    )
    headers = {"Authorization": f"Bearer {token}"}

    create_response = await client.post(
        "/api/v1/client/planner/plans",
        json={"prompt": f"Birthday party for 50 guests in {VENDOR_CITY}, budget 900"},
        headers=headers,
    )
    assert create_response.status_code == 200, create_response.text
    plan_body = create_response.json()
    plan_id = plan_body["plan_id"]
    hair_need = next(
        recommendation
        for recommendation in plan_body["recommendations"]
        if recommendation["service_key"] == "hair_styling"
    )
    original_primary_id = hair_need["primary"]["user_id"]

    replace_response = await client.post(
        f"/api/v1/client/planner/plans/{plan_id}/items/{hair_need['need_id']}/replace",
        json={},
        headers=headers,
    )

    assert replace_response.status_code == 200, replace_response.text
    replaced_primary = replace_response.json()["recommendation"]["primary"]
    assert replaced_primary is not None
    assert replaced_primary["user_id"] != original_primary_id
