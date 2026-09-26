"""Freeze: the client AI Event Planner (create/list/get/replace/ensure-event/archive
plans) and the client events list/detail it links to.

Covers `/api/v1/client/planner/plans` (create, list, detail, replace-item,
ensure-event, archive) and `/api/v1/client/events` (list, detail). Both slices
are `require_client`-gated (see `backend/app/features/auth/http/guards.py`).

NOT FROZEN - a successful create. `generate_plan` classifies the prompt with the
LLM (`parse_marketplace_query`); without a reachable OpenAI client the token-only
fallback always answers `mode="simple"`, so every prompt gets `simple_intent`.
That is an environment artefact, not behaviour to copy, so only the rejections
that do not depend on the model are frozen here. `api/` covers the happy path
with the fake language model.

Because create needs the model, every other planner op (list,
detail, replace-item, ensure-event, archive) is exercised by seeding a
`celebration_plans` + `celebration_plan_items` row pair directly through
`admin_db`, exactly as `generate_plan` would have written them, then calling
the real HTTP routes against that seeded plan. This is possible because - and
worth knowing for a slice README - GET/list never recompute `why_selected`,
`cost_assumption` or `summary`: they echo the stored columns as-is. Only
`replace-item` recomputes anything, and it recomputes through the very same
`try_openai_client()`-gated helper (`why_for_vendor` in
`planner_summary_generation.py`), so in this environment its "why" text also
falls back to the deterministic `template_why_selected` format, which is
asserted here literally.

Deterministic vendor selection: the planner ranks the whole approved,
publicly-listed vendor pool with `VendorRankingEngine` (`backend/app/features/
vendors/ranking/`). Reviews, completed bookings, conversion rate and response
speed all default to a neutral 0.5 signal when a vendor has none on record, so
a freshly seeded vendor with no bookings is only distinguished by
`location_fit` and `budget_fit` - both computed straight from the vendor row
(`base_city_normalized`, `min_list_price_gbp`).

NOT FROZEN - a successful replace-item. `load_enriched_vendor_pool()` puts every
approved vendor's id into one PostgREST query string to look up emails
(`list_approved_vendors_for_explore` in `backend/app/features/vendors/moderation.py`).
With the hundreds of vendors earlier freeze runs leave in local Supabase the URL
passes the URI length limit and the request 500s. That is a real scalability bug
in the baseline (recorded in `docs/domain-rules.md`); `api/` reads the pool with
one SQL query and has no such limit. Only the unknown-need 404, which runs first,
is frozen here.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import date

from supabase import Client

from conftest import API, TARGET, new_browser, sign_in
from support.accounts import seed_account, unique_email

PLANNER_URL = f"{API}/client/planner"
EVENTS_URL = f"{API}/client/events"

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. Sign in with a client account, or create one from the "
    "homepage."
)
DESCRIBE_CELEBRATION = "Describe your celebration in a few words."
INVALID_PROMPT = "Describe your celebration in a few words - for example a birthday in London for 80 guests."
SIMPLE_INTENT = "This looks like a simple vendor search. Try Browse instead."
PLAN_NOT_FOUND = "Plan not found."
PLAN_ARCHIVED = "That plan is archived."
PLAN_ITEM_NOT_FOUND = "That plan item was not found."
INVALID_EVENT_ID = "Invalid event id."
EVENT_NOT_FOUND = "Event not found."
INVALID_STATUS_FILTER = "status must be active, archived, or all."

# A UUID no plan/event will ever have, for 404 checks.
MISSING_ID = "00000000-0000-4000-8000-000000000000"

BUDGET_ASSUMPTION_LINE = (
    "Each line is the estimated cost for the recommended vendor - not a forced split of your budget."
)
OVER_BUDGET_ASSUMPTION_LINE = (
    "Your budget is a target. We still recommend strong vendors and flag when estimates exceed it."
)


def _assert_error_code(body: dict[str, object], api_code: str) -> None:
    """The baseline sends these errors without a `code`; api/ gives every error one (ADR 0004)."""
    if TARGET == "api":
        assert body["code"] == api_code
    else:
        assert "code" not in body


def _unique_city(label: str) -> str:
    """A celebration location no other freeze test or seeded vendor has ever used."""
    suffix = secrets.token_hex(4)
    return f"{label.replace('_', '')}{suffix}".title()


def _seed_hair_stylist(
    admin_db: Client,
    label: str,
    *,
    city: str,
    min_list_price_gbp: float,
) -> tuple[str, str]:
    """An approved, publicly-listed vendor offering only `hair_styling`. Returns (user_id, business_name)."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    business_name = f"{label}-{uuid.uuid4().hex[:6]} Hair Studio"
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "acceptance suite: planner vendor pool",
            "services_offered": ["hair_styling"],
            "base_city_normalized": city.lower(),
            "min_list_price_gbp": min_list_price_gbp,
            "payload": {
                "businessName": business_name,
                "servicesOffered": ["hair_styling"],
                "baseCity": city,
                # BASELINE QUIRK: the single-vendor lookup the planner uses for GET/list
                # (`get_approved_vendor_for_explore_by_id` in
                # `backend/app/features/vendors/moderation.py`) selects only
                # "user_id,status,approval_status,payload,updated_at" - it never selects
                # the `min_list_price_gbp` column. `build_fact_card` falls back to
                # `payload["min_list_price_gbp"]` when the column is missing, so it has
                # to be duplicated into payload here for GET to see a real vendor price
                # at all; otherwise every plan detail silently uses the "no list price
                # yet" template estimate regardless of the vendor's real price.
                "min_list_price_gbp": min_list_price_gbp,
            },
        }
    ).execute()
    return account.user_id, business_name


def _expected_brief(*, title: str, location: str, budget_gbp: float) -> dict:
    """The full `CelebrationBrief` shape the API echoes back, defaults filled in."""
    return {
        "event_type": "birthdays",
        "event_kind": "standard",
        "location": location,
        "related_locations": [],
        "guest_count": 40,
        "budget_gbp": budget_gbp,
        "preferred_date": None,
        "preferred_date_invalid": False,
        "indoor_outdoor": None,
        "cuisine_notes": None,
        "music_notes": None,
        "special_requirements": None,
        "excluded_needs": [],
        "currency_assumed_gbp": False,
        "raw_prompt": title,
        "unsupported_categories_mentioned": [],
    }


def _seed_hair_plan(
    admin_db: Client,
    client_user_id: str,
    *,
    title: str,
    location: str,
    budget_gbp: float,
    primary_vendor_user_id: str,
    primary_why_selected: str,
    estimated_cost_gbp: float,
    alternative_vendor_user_ids: list[str] | None = None,
    confidence_score: int = 94,
) -> dict:
    """Seed one `celebration_plans` row plus a single "hair" `celebration_plan_items` row,
    exactly as `generate_plan` would have written them - bypassing the broken create
    endpoint (see module docstring). Returns the inserted plan row.
    """
    confidence_reasons = ["Some recommended vendors have few reviews yet."]
    summary = f"{title}: a birthdays plan in {location} for about 40 guests. Covering Hair styling."
    remaining = round(budget_gbp - estimated_cost_gbp, 2)
    plan_row = (
        admin_db.table("celebration_plans")
        .insert(
            {
                "client_user_id": client_user_id,
                "title": title,
                "raw_prompt": title,
                "brief": _expected_brief(title=title, location=location, budget_gbp=budget_gbp),
                "confidence_score": confidence_score,
                "confidence_reasons": confidence_reasons,
                "summary": summary,
                "budget_total_gbp": estimated_cost_gbp,
                "budget_remaining_gbp": remaining,
                "currency": "GBP",
            }
        )
        .execute()
        .data[0]
    )
    admin_db.table("celebration_plan_items").insert(
        {
            "plan_id": plan_row["id"],
            "need_id": "hair",
            "label": "Hair styling",
            "service_key": "hair_styling",
            "optional": True,
            "primary_vendor_user_id": primary_vendor_user_id,
            "alternative_vendor_user_ids": alternative_vendor_user_ids or [],
            "estimated_cost_gbp": estimated_cost_gbp,
            "why_selected": primary_why_selected,
        }
    ).execute()
    return plan_row


def test_create_plan_without_a_session_is_401() -> None:
    """POST /client/planner/plans requires sign-in."""
    with new_browser() as browser:
        response = browser.post(f"{PLANNER_URL}/plans", json={"prompt": "Birthday party in London"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_create_plan_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot use the client planner: the client-portal message, not a generic 403."""
    account = seed_account(admin_db, unique_email("planner-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(f"{PLANNER_URL}/plans", json={"prompt": "Birthday party in London"})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_create_plan_rejects_a_blank_prompt(admin_db: Client) -> None:
    """A prompt that is only whitespace is rejected before any parsing happens."""
    account = seed_account(admin_db, unique_email("planner-blank"), "client")
    browser = sign_in(account)
    response = browser.post(f"{PLANNER_URL}/plans", json={"prompt": "   "})
    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == DESCRIBE_CELEBRATION
    _assert_error_code(body, "describe_celebration")


def test_create_plan_rejects_a_nonsense_prompt(admin_db: Client) -> None:
    """A prompt with no letters is rejected as nonsense, with its own error code."""
    account = seed_account(admin_db, unique_email("planner-nonsense"), "client")
    browser = sign_in(account)
    response = browser.post(f"{PLANNER_URL}/plans", json={"prompt": "12345"})
    assert response.status_code == 400
    assert response.json() == {"detail": INVALID_PROMPT, "code": "invalid_prompt"}


def test_create_plan_rejects_a_single_service_browse_query(admin_db: Client) -> None:
    """A plain "vendor + city" search is redirected to Browse, not turned into a plan."""
    account = seed_account(admin_db, unique_email("planner-simple"), "client")
    browser = sign_in(account)
    response = browser.post(f"{PLANNER_URL}/plans", json={"prompt": "photographers in Bristol"})
    assert response.status_code == 400
    assert response.json() == {"detail": SIMPLE_INTENT, "code": "simple_intent"}


def test_list_plans_returns_only_this_clients_active_plans(admin_db: Client) -> None:
    """GET /plans lists the caller's own non-archived plans, in the list-item shape."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"list{label}")
    account = seed_account(admin_db, unique_email(f"planner-list-{label}"), "client")
    other_account = seed_account(admin_db, unique_email(f"planner-list-other-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-list-{label}", city=city, min_list_price_gbp=250.0
    )

    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=f"List test plan {label}",
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £250.",
        estimated_cost_gbp=250.0,
    )
    # A plan from a different client must never appear in this client's list.
    other_city = _unique_city(f"list-other{label}")
    other_vendor_id, other_vendor_name = _seed_hair_stylist(
        admin_db, f"plan-list-other-{label}", city=other_city, min_list_price_gbp=250.0
    )
    _seed_hair_plan(
        admin_db,
        other_account.user_id,
        title=f"Other client's plan {label}",
        location=other_city,
        budget_gbp=800.0,
        primary_vendor_user_id=other_vendor_id,
        primary_why_selected=f"{other_vendor_name} - based in {other_city}; from about £250.",
        estimated_cost_gbp=250.0,
    )

    response = browser.get(f"{PLANNER_URL}/plans")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert len(body["plans"]) == 1
    listed = body["plans"][0]
    assert listed == {
        "plan_id": plan_row["id"],
        "title": plan_row["title"],
        "event_type": "birthdays",
        "location": city,
        "confidence_score": 94,
        "status": "active",
        "created_at": listed["created_at"],
        "updated_at": listed["updated_at"],
    }


def test_list_plans_without_a_session_is_401() -> None:
    """GET /client/planner/plans requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{PLANNER_URL}/plans")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_plan_detail_matches_the_seeded_plan_and_recomputes_its_budget(admin_db: Client) -> None:
    """GET /plans/{plan_id} echoes the stored brief/summary/confidence and recomputes the budget line."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"detail{label}")
    account = seed_account(admin_db, unique_email(f"planner-detail-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-detail-{label}", city=city, min_list_price_gbp=300.0
    )
    title = f"Detail test plan {label}"
    why_selected = f"{good_name} - based in {city}; from about £300."
    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=title,
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=why_selected,
        estimated_cost_gbp=300.0,
    )

    response = browser.get(f"{PLANNER_URL}/plans/{plan_row['id']}")
    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["plan_id"] == plan_row["id"]
    assert body["status"] == "active"
    assert body["client_event_id"] is None
    assert body["celebration"] == {
        "title": title,
        "event_type": "birthdays",
        "location": city,
        "guest_count": 40,
        "budget_gbp": 800.0,
        "preferred_date": None,
        "summary": plan_row["summary"],
    }
    assert body["brief"] == _expected_brief(title=title, location=city, budget_gbp=800.0)
    assert body["confidence"] == {
        "score": 94,
        "reasons": ["Some recommended vendors have few reviews yet."],
    }
    assert body["budget"] == {
        "lines": [
            {
                "need_id": "hair",
                "label": "Hair styling",
                "amount_gbp": 300.0,
                "allocated_gbp": 800.0,
                "assumption": f"From {good_name}'s lowest listed package/rate on Eventtz",
            }
        ],
        "total_estimated_gbp": 300.0,
        "remaining_budget_gbp": 500.0,
        "user_budget_gbp": 800.0,
        "over_budget": False,
        "assumptions": [BUDGET_ASSUMPTION_LINE],
    }
    assert len(body["recommendations"]) == 1
    recommendation = body["recommendations"][0]
    assert recommendation["need_id"] == "hair"
    assert recommendation["label"] == "Hair styling"
    assert recommendation["service_key"] == "hair_styling"
    assert recommendation["optional"] is True
    assert recommendation["primary"]["user_id"] == good_id
    assert recommendation["primary"]["business_name"] == good_name
    assert recommendation["primary"]["min_list_price_gbp"] == 300.0
    assert recommendation["primary"]["unavailable"] is False
    assert recommendation["alternatives"] == []
    assert recommendation["estimated_cost_gbp"] == 300.0
    # GET never recomputes why_selected - it echoes the stored column verbatim.
    assert recommendation["why_selected"] == why_selected
    assert recommendation["empty_reason"] is None
    assert body["created_at"] == plan_row["created_at"]
    assert body["updated_at"] == plan_row["updated_at"]


def test_get_plan_detail_is_not_found_for_another_clients_plan(admin_db: Client) -> None:
    """A plan_id that exists but belongs to a different client reads as not-found, not forbidden."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"cross{label}")
    owner_account = seed_account(admin_db, unique_email(f"planner-cross-owner-{label}"), "client")
    other_account = seed_account(admin_db, unique_email(f"planner-cross-other-{label}"), "client")
    other_browser = sign_in(other_account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-cross-{label}", city=city, min_list_price_gbp=300.0
    )
    plan_row = _seed_hair_plan(
        admin_db,
        owner_account.user_id,
        title=f"Cross-client plan {label}",
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £300.",
        estimated_cost_gbp=300.0,
    )

    response = other_browser.get(f"{PLANNER_URL}/plans/{plan_row['id']}")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == PLAN_NOT_FOUND
    _assert_error_code(body, "plan_not_found")


def test_get_plan_detail_is_not_found_for_an_unknown_plan_id(admin_db: Client) -> None:
    """A syntactically fine but nonexistent plan_id is a plain 404, no id-format check first."""
    account = seed_account(admin_db, unique_email("planner-missing"), "client")
    browser = sign_in(account)
    response = browser.get(f"{PLANNER_URL}/plans/{MISSING_ID}")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == PLAN_NOT_FOUND
    _assert_error_code(body, "plan_not_found")


def test_replace_plan_item_for_an_unknown_need_id_is_not_found(admin_db: Client) -> None:
    """A need_id that is not on the plan (typo, or already replaced away) is a plain 404."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"needmiss{label}")
    account = seed_account(admin_db, unique_email(f"planner-needmiss-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-needmiss-{label}", city=city, min_list_price_gbp=300.0
    )
    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=f"Need-missing test plan {label}",
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £300.",
        estimated_cost_gbp=300.0,
    )

    response = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/items/not-a-need/replace", json={})
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == PLAN_ITEM_NOT_FOUND
    _assert_error_code(body, "plan_item_not_found")


def test_ensure_plan_event_creates_and_links_a_client_event(admin_db: Client) -> None:
    """ensure-event creates a `client_events` row from the plan's title/location and links it back."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"ensure{label}")
    account = seed_account(admin_db, unique_email(f"planner-ensure-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-ensure-{label}", city=city, min_list_price_gbp=300.0
    )
    title = f"Ensure-event test plan {label}"
    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=title,
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £300.",
        estimated_cost_gbp=300.0,
    )

    response = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/ensure-event")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["plan_id"] == plan_row["id"]
    assert uuid.UUID(body["event_id"])
    assert body["title"] == title
    assert body["event_date"] == date.today().isoformat()
    assert body["event_address"] == city
    assert body["event_postcode"] is None

    event_row = admin_db.table("client_events").select("*").eq("id", body["event_id"]).execute().data[0]
    assert event_row["client_user_id"] == account.user_id
    assert event_row["title"] == title
    assert event_row["status"] == "active"

    linked_plan_row = (
        admin_db.table("celebration_plans")
        .select("client_event_id")
        .eq("id", plan_row["id"])
        .execute()
        .data[0]
    )
    assert linked_plan_row["client_event_id"] == body["event_id"]

    # Calling it again returns the same event rather than creating a second one.
    again = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/ensure-event")
    assert again.status_code == 200
    assert again.json()["event_id"] == body["event_id"]
    all_events = (
        admin_db.table("client_events").select("id").eq("client_user_id", account.user_id).execute().data
    )
    assert len(all_events) == 1


def test_ensure_plan_event_on_an_archived_plan_is_rejected(admin_db: Client) -> None:
    """An archived plan cannot be turned into an event without starting a fresh plan."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"archevent{label}")
    account = seed_account(admin_db, unique_email(f"planner-archevent-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-archevent-{label}", city=city, min_list_price_gbp=300.0
    )
    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=f"Arch-event test plan {label}",
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £300.",
        estimated_cost_gbp=300.0,
    )
    archive_response = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/archive")
    assert archive_response.status_code == 200

    response = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/ensure-event")
    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == PLAN_ARCHIVED
    _assert_error_code(body, "plan_archived")


def test_archive_plan_hides_it_from_the_list_but_not_from_detail(admin_db: Client) -> None:
    """Archiving a plan flips its status and removes it from the (always-active) list."""
    label = uuid.uuid4().hex[:8]
    city = _unique_city(f"archive{label}")
    account = seed_account(admin_db, unique_email(f"planner-archive-{label}"), "client")
    browser = sign_in(account)
    good_id, good_name = _seed_hair_stylist(
        admin_db, f"plan-archive-{label}", city=city, min_list_price_gbp=300.0
    )
    plan_row = _seed_hair_plan(
        admin_db,
        account.user_id,
        title=f"Archive test plan {label}",
        location=city,
        budget_gbp=800.0,
        primary_vendor_user_id=good_id,
        primary_why_selected=f"{good_name} - based in {city}; from about £300.",
        estimated_cost_gbp=300.0,
    )

    response = browser.post(f"{PLANNER_URL}/plans/{plan_row['id']}/archive")
    assert response.status_code == 200
    assert response.json() == {"success": True, "plan_id": plan_row["id"], "status": "archived"}

    stored_status = (
        admin_db.table("celebration_plans").select("status").eq("id", plan_row["id"]).execute().data[0]
    )
    assert stored_status["status"] == "archived"

    list_response = browser.get(f"{PLANNER_URL}/plans")
    assert plan_row["id"] not in {plan["plan_id"] for plan in list_response.json()["plans"]}

    detail_response = browser.get(f"{PLANNER_URL}/plans/{plan_row['id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "archived"


def test_archive_plan_for_an_unknown_plan_id_is_not_found(admin_db: Client) -> None:
    """Archiving a plan_id that does not exist (or isn't the caller's) is a plain 404."""
    account = seed_account(admin_db, unique_email("planner-archive-missing"), "client")
    browser = sign_in(account)
    response = browser.post(f"{PLANNER_URL}/plans/{MISSING_ID}/archive")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == PLAN_NOT_FOUND
    _assert_error_code(body, "plan_not_found")


def test_list_client_events_without_a_session_is_401() -> None:
    """GET /client/events requires sign-in."""
    with new_browser() as browser:
        response = browser.get(EVENTS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_list_client_events_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot list client events."""
    account = seed_account(admin_db, unique_email("events-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(EVENTS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_list_client_events_rejects_an_invalid_status_filter(admin_db: Client) -> None:
    """A `status` query value outside active/archived/all is a 400, not a silent fallback."""
    account = seed_account(admin_db, unique_email("events-badstatus"), "client")
    browser = sign_in(account)
    response = browser.get(EVENTS_URL, params={"status": "bogus"})
    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == INVALID_STATUS_FILTER
    _assert_error_code(body, "invalid_status_filter")


def test_list_client_events_filters_by_status(admin_db: Client) -> None:
    """`status=active` (the default), `archived` and `all` each scope the list correctly."""
    label = uuid.uuid4().hex[:8]
    account = seed_account(admin_db, unique_email(f"events-status-{label}"), "client")
    browser = sign_in(account)
    active_row = (
        admin_db.table("client_events")
        .insert(
            {
                "client_user_id": account.user_id,
                "title": f"Active event {label}",
                "event_date": "2099-06-01",
                "status": "active",
            }
        )
        .execute()
        .data[0]
    )
    archived_row = (
        admin_db.table("client_events")
        .insert(
            {
                "client_user_id": account.user_id,
                "title": f"Archived event {label}",
                "event_date": "2099-07-01",
                "status": "archived",
            }
        )
        .execute()
        .data[0]
    )

    active_response = browser.get(EVENTS_URL)
    assert active_response.status_code == 200
    assert {event["id"] for event in active_response.json()["events"]} == {active_row["id"]}

    archived_response = browser.get(EVENTS_URL, params={"status": "archived"})
    assert archived_response.status_code == 200
    assert {event["id"] for event in archived_response.json()["events"]} == {archived_row["id"]}

    all_response = browser.get(EVENTS_URL, params={"status": "all"})
    assert all_response.status_code == 200
    assert {event["id"] for event in all_response.json()["events"]} == {active_row["id"], archived_row["id"]}

    active_summary = next(event for event in all_response.json()["events"] if event["id"] == active_row["id"])
    assert active_summary == {
        "id": active_row["id"],
        "title": f"Active event {label}",
        "event_date": "2099-06-01",
        "event_end_date": None,
        "event_address": None,
        "event_postcode": None,
        "status": "active",
        "booking_count": 0,
        "active_booking_count": 0,
        "updated_at": active_summary["updated_at"],
    }


def test_get_client_event_detail_happy_path(admin_db: Client) -> None:
    """GET /client/events/{event_id} returns the full detail shape for the caller's own event."""
    label = uuid.uuid4().hex[:8]
    account = seed_account(admin_db, unique_email(f"events-detail-{label}"), "client")
    browser = sign_in(account)
    row = (
        admin_db.table("client_events")
        .insert(
            {
                "client_user_id": account.user_id,
                "title": f"Detail event {label}",
                "event_date": "2099-08-15",
                "event_address": "12 Test Street",
                "event_postcode": "AB1 2CD",
                "status": "active",
            }
        )
        .execute()
        .data[0]
    )

    response = browser.get(f"{EVENTS_URL}/{row['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    event = body["event"]
    assert event["id"] == row["id"]
    assert event["title"] == f"Detail event {label}"
    assert event["event_date"] == "2099-08-15"
    assert event["event_address"] == "12 Test Street"
    assert event["event_postcode"] == "AB1 2CD"
    assert event["status"] == "active"
    assert event["booking_count"] == 0
    assert event["active_booking_count"] == 0
    assert event["created_at"] is not None


def test_get_client_event_detail_rejects_a_malformed_event_id(admin_db: Client) -> None:
    """A non-UUID event_id is rejected before any database lookup."""
    account = seed_account(admin_db, unique_email("events-badid"), "client")
    browser = sign_in(account)
    response = browser.get(f"{EVENTS_URL}/not-a-uuid")
    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == INVALID_EVENT_ID
    _assert_error_code(body, "invalid_event_id")


def test_get_client_event_detail_is_not_found_for_an_unknown_event_id(admin_db: Client) -> None:
    """A syntactically fine but nonexistent event_id is a plain 404."""
    account = seed_account(admin_db, unique_email("events-missing"), "client")
    browser = sign_in(account)
    response = browser.get(f"{EVENTS_URL}/{MISSING_ID}")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == EVENT_NOT_FOUND
    _assert_error_code(body, "event_not_found")


def test_get_client_event_detail_is_not_found_for_another_clients_event(admin_db: Client) -> None:
    """An event that exists but belongs to a different client reads as not-found."""
    label = uuid.uuid4().hex[:8]
    owner_account = seed_account(admin_db, unique_email(f"events-cross-owner-{label}"), "client")
    other_account = seed_account(admin_db, unique_email(f"events-cross-other-{label}"), "client")
    other_browser = sign_in(other_account)
    row = (
        admin_db.table("client_events")
        .insert(
            {
                "client_user_id": owner_account.user_id,
                "title": f"Owner-only event {label}",
                "event_date": "2099-09-01",
                "status": "active",
            }
        )
        .execute()
        .data[0]
    )

    response = other_browser.get(f"{EVENTS_URL}/{row['id']}")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"] == EVENT_NOT_FOUND
    _assert_error_code(body, "event_not_found")
