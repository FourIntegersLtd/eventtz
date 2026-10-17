"""Freeze: client first-visit onboarding, AI-assisted vendor onboarding, and the vendor
Growth Co-pilot - with OpenAI unconfigured in this environment (`OPENAI_API_KEY=""`).

Covers `/api/v1/client/onboarding` (get/patch, owned by the `settings` slice), and two
`vendors`-adjacent slices mounted for signed-in vendors only: `/api/v1/vendor/onboarding/ai/*`
(bio writing, portfolio photo QA, package coaching during signup) and
`/api/v1/vendor/copilot/*` (the post-launch Growth Co-pilot: ask, brief, draft-reply,
review-packages, score).

Every AI call that reaches OpenAI goes through `require_openai_client`, which raises a
503 with `OPENAI_UNAVAILABLE` the moment `OPENAI_API_KEY` is blank - there is no key in
this environment, so that 503 is what every "happy path" AI call freezes here. Two
routes still have real, OpenAI-free behaviour worth freezing exactly: the Growth Score
(`GET /vendor/copilot/score`) and its plain-English wrapper the daily brief
(`GET /vendor/copilot/brief`) are computed by deterministic Python, and the brief's LLM
narration step catches its own OpenAI failure internally and falls back to fixed copy
instead of failing the request. `POST /vendor/copilot/draft-reply` for a booking id that
does not exist also returns a fixed placeholder before ever reaching OpenAI.

Every test seeds a fresh account with `seed_account`/`unique_email` so runs stay
independent of each other and of other freeze files run in the same suite.
"""

from __future__ import annotations

from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or "
    "sign out and sign in again so we can refresh your account type. If you're planning an event, use "
    "client sign-in instead."
)
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. Sign in with a client account, or create one from the "
    "homepage."
)
OPENAI_UNAVAILABLE = "This AI feature isn't available right now. Please try again later."
QUESTION_REQUIRED = "Question is required."
CHOOSE_IMAGE_TO_UPLOAD = "Please choose an image to upload."
ONLY_IMAGE_UPLOADS = "Only image uploads are supported."
BOOKING_NOT_FOUND_TIP = "Booking not found."

ONBOARDING_URL = f"{API}/client/onboarding"
GENERATE_BIO_URL = f"{API}/vendor/onboarding/ai/generate-bio"
REVIEW_PACKAGES_AI_URL = f"{API}/vendor/onboarding/ai/review-packages"
ANALYZE_IMAGE_URL = f"{API}/vendor/onboarding/ai/analyze-portfolio-image"
COPILOT_ASK_URL = f"{API}/vendor/copilot/ask"
COPILOT_BRIEF_URL = f"{API}/vendor/copilot/brief"
COPILOT_DRAFT_REPLY_URL = f"{API}/vendor/copilot/draft-reply"
COPILOT_REVIEW_PACKAGES_URL = f"{API}/vendor/copilot/review-packages"
COPILOT_SCORE_URL = f"{API}/vendor/copilot/score"

# A UUID no booking will ever have, for "not found" checks.
MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"
# A package with details long enough to pass the vendor payload's own quality bar
# (not exercised directly here, but kept realistic for the seeded booking's line item).
PACKAGE_DETAILS = "A full package covering setup, service and clearup on the day."


def _seed_vendor(admin_db: LocalDatabase, label: str, *, payload: dict[str, object] | None = None) -> SeededAccount:
    """A fresh vendor account with a `vendors` row inserted directly (profile "found")."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "draft",
            "approval_status": "pending",
            "payload": payload or {},
        }
    ).execute()
    return account


def _seed_booking_request(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "pending",
) -> str:
    """A minimal `booking_requests` row this vendor can draft a reply to."""
    row = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": "Acceptance test event",
        "event_date": "2099-06-01",
        "status": status,
        "payment_status": "unpaid",
        "initiator": "client",
        "total_label": "£150",
        "selected_option_ids": ["pkg-1"],
        "line_items": [
            {
                "id": "pkg-1",
                "heading": "Classic Package",
                "unit_price_gbp": 150.0,
                "description": PACKAGE_DETAILS,
            }
        ],
        "vendor_adjustments": [],
    }
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


# ---------------------------------------------------------------------------
# /api/v1/client/onboarding
# ---------------------------------------------------------------------------


def test_get_client_onboarding_without_a_session_is_401() -> None:
    """GET /client/onboarding requires sign-in."""
    with new_browser() as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_client_onboarding_is_forbidden_for_a_vendor(admin_db: LocalDatabase) -> None:
    """A vendor account gets the client-portal message, not the vendor one."""
    account = seed_account(admin_db, unique_email("onb-get-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(ONBOARDING_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_get_client_onboarding_default_state_for_a_fresh_client(admin_db: LocalDatabase) -> None:
    """A brand-new client has not completed onboarding and has no preferred name yet."""
    account = seed_account(admin_db, unique_email("onb-get-fresh"), "client")
    browser = sign_in(account)
    response = browser.get(ONBOARDING_URL)
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "onboarding": {"completed": False, "preferred_name": None},
    }


def test_patch_client_onboarding_without_a_session_is_401() -> None:
    """PATCH /client/onboarding requires sign-in."""
    with new_browser() as browser:
        response = browser.patch(ONBOARDING_URL, json={"preferred_name": "Ada"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_patch_client_onboarding_is_forbidden_for_a_vendor(admin_db: LocalDatabase) -> None:
    """A vendor account cannot patch client onboarding state."""
    account = seed_account(admin_db, unique_email("onb-patch-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.patch(ONBOARDING_URL, json={"preferred_name": "Ada"})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_patch_client_onboarding_sets_preferred_name_and_marks_completed(admin_db: LocalDatabase) -> None:
    """A valid patch persists both fields and echoes them back."""
    account = seed_account(admin_db, unique_email("onb-patch-ok"), "client")
    browser = sign_in(account)
    response = browser.patch(ONBOARDING_URL, json={"preferred_name": "Ada", "mark_completed": True})
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "onboarding": {"completed": True, "preferred_name": "Ada"},
    }

    row = (
        admin_db.table("users")
        .select("preferred_name,client_onboarding_completed_at")
        .eq("id", account.user_id)
        .execute()
        .data[0]
    )
    assert row["preferred_name"] == "Ada"
    assert row["client_onboarding_completed_at"] is not None


def test_patch_client_onboarding_preferred_name_too_long_is_422(admin_db: LocalDatabase) -> None:
    """`preferred_name` over 80 characters is rejected by the request model."""
    account = seed_account(admin_db, unique_email("onb-patch-long"), "client")
    browser = sign_in(account)
    response = browser.patch(ONBOARDING_URL, json={"preferred_name": "a" * 81})
    assert response.status_code == 422


def test_patch_client_onboarding_blank_preferred_name_clears_it(admin_db: LocalDatabase) -> None:
    """A blank/whitespace preferred_name is stored as null, not the literal blank string."""
    account = seed_account(admin_db, unique_email("onb-patch-blank"), "client")
    browser = sign_in(account)
    first = browser.patch(ONBOARDING_URL, json={"preferred_name": "Ada"})
    assert first.status_code == 200

    second = browser.patch(ONBOARDING_URL, json={"preferred_name": "   "})
    assert second.status_code == 200
    assert second.json()["onboarding"]["preferred_name"] is None


# ---------------------------------------------------------------------------
# /api/v1/vendor/onboarding/ai/*
# ---------------------------------------------------------------------------


def test_generate_bio_without_a_session_is_401() -> None:
    """POST /vendor/onboarding/ai/generate-bio requires sign-in."""
    with new_browser() as browser:
        response = browser.post(GENERATE_BIO_URL, json={"profile_form_data": {}})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_generate_bio_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot use vendor bio generation: the vendor-portal message."""
    account = seed_account(admin_db, unique_email("bio-client"), "client")
    browser = sign_in(account)
    response = browser.post(GENERATE_BIO_URL, json={"profile_form_data": {}})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_generate_bio_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """A signed-in vendor's bio request reaches OpenAI and fails immediately: no key configured.

    `generate_vendor_public_bio` calls `require_openai_client` before doing anything else,
    so this 503 with `OPENAI_UNAVAILABLE` is the whole observable behaviour here, for any
    `profile_form_data`.
    """
    account = seed_account(admin_db, unique_email("bio-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(
        GENERATE_BIO_URL,
        json={"profile_form_data": {"businessName": "Ada's Cakes", "baseCity": "London"}},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


def test_review_packages_ai_without_a_session_is_401() -> None:
    """POST /vendor/onboarding/ai/review-packages requires sign-in."""
    with new_browser() as browser:
        response = browser.post(REVIEW_PACKAGES_AI_URL, json={"profile_form_data": {}})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_review_packages_ai_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot use the onboarding package coach."""
    account = seed_account(admin_db, unique_email("pkgai-client"), "client")
    browser = sign_in(account)
    response = browser.post(REVIEW_PACKAGES_AI_URL, json={"profile_form_data": {}})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_review_packages_ai_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """`review_vendor_packages` also calls `require_openai_client` first: same 503 shape."""
    account = seed_account(admin_db, unique_email("pkgai-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(
        REVIEW_PACKAGES_AI_URL,
        json={"profile_form_data": {"packages": [{"title": "Package 1", "price": "100"}]}},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


def test_analyze_portfolio_image_without_a_session_is_401() -> None:
    """POST /vendor/onboarding/ai/analyze-portfolio-image requires sign-in."""
    with new_browser() as browser:
        response = browser.post(
            ANALYZE_IMAGE_URL, files={"file": ("photo.jpg", b"not-really-a-photo", "image/jpeg")}
        )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_analyze_portfolio_image_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot use the portfolio photo QA tool."""
    account = seed_account(admin_db, unique_email("img-client"), "client")
    browser = sign_in(account)
    response = browser.post(
        ANALYZE_IMAGE_URL, files={"file": ("photo.jpg", b"not-really-a-photo", "image/jpeg")}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_analyze_portfolio_image_empty_file_is_400(admin_db: LocalDatabase) -> None:
    """An empty upload is rejected before OpenAI is ever reached, regardless of content type."""
    account = seed_account(admin_db, unique_email("img-empty"), "vendor")
    browser = sign_in(account)
    response = browser.post(ANALYZE_IMAGE_URL, files={"file": ("empty.jpg", b"", "image/jpeg")})
    assert response.status_code == 400
    assert response.json()["detail"] == CHOOSE_IMAGE_TO_UPLOAD


def test_analyze_portfolio_image_non_image_content_type_is_400(admin_db: LocalDatabase) -> None:
    """A non-empty upload whose content type is not image/* is rejected before OpenAI."""
    account = seed_account(admin_db, unique_email("img-wrongtype"), "vendor")
    browser = sign_in(account)
    response = browser.post(ANALYZE_IMAGE_URL, files={"file": ("notes.txt", b"just some text", "text/plain")})
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_IMAGE_UPLOADS


def test_analyze_portfolio_image_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """A valid non-empty image upload passes validation and then fails at OpenAI: 503."""
    account = seed_account(admin_db, unique_email("img-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(
        ANALYZE_IMAGE_URL, files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0fake-jpeg-bytes", "image/jpeg")}
    )
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


# ---------------------------------------------------------------------------
# /api/v1/vendor/copilot/ask
# ---------------------------------------------------------------------------


def test_copilot_ask_without_a_session_is_401() -> None:
    """POST /vendor/copilot/ask requires sign-in."""
    with new_browser() as browser:
        response = browser.post(COPILOT_ASK_URL, json={"question": "How do I get more bookings?"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_copilot_ask_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot ask the vendor Growth Co-pilot anything."""
    account = seed_account(admin_db, unique_email("ask-client"), "client")
    browser = sign_in(account)
    response = browser.post(COPILOT_ASK_URL, json={"question": "How do I get more bookings?"})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_copilot_ask_empty_string_question_is_422(admin_db: LocalDatabase) -> None:
    """`question` has `min_length=1`, so the literal empty string fails request validation."""
    account = seed_account(admin_db, unique_email("ask-empty"), "vendor")
    browser = sign_in(account)
    response = browser.post(COPILOT_ASK_URL, json={"question": ""})
    assert response.status_code == 422


def test_copilot_ask_blank_question_is_400(admin_db: LocalDatabase) -> None:
    """A whitespace-only question passes the schema's min_length but fails the route's own check.

    BASELINE QUIRK: `CopilotAskRequest.question` only rejects the literal empty string
    (min_length=1), so "   " reaches the route and is caught there with a different
    status/detail (400 QUESTION_REQUIRED) than the empty string (422).
    """
    account = seed_account(admin_db, unique_email("ask-blank"), "vendor")
    browser = sign_in(account)
    response = browser.post(COPILOT_ASK_URL, json={"question": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == QUESTION_REQUIRED


def test_copilot_ask_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """A real question reaches `ask_copilot`, which fails at `require_openai_client`: 503."""
    account = seed_account(admin_db, unique_email("ask-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(COPILOT_ASK_URL, json={"question": "How do I get more bookings?"})
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


# ---------------------------------------------------------------------------
# /api/v1/vendor/copilot/brief
# ---------------------------------------------------------------------------


def test_copilot_brief_without_a_session_is_401() -> None:
    """GET /vendor/copilot/brief requires sign-in."""
    with new_browser() as browser:
        response = browser.get(COPILOT_BRIEF_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_copilot_brief_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot fetch the vendor daily brief."""
    account = seed_account(admin_db, unique_email("brief-client"), "client")
    browser = sign_in(account)
    response = browser.get(COPILOT_BRIEF_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_copilot_brief_without_a_vendor_profile_returns_welcome_fallback(admin_db: LocalDatabase) -> None:
    """No `vendors` row at all: a fixed "complete your profile" brief, never touching OpenAI."""
    account = seed_account(admin_db, unique_email("brief-noprofile"), "vendor")
    browser = sign_in(account)
    response = browser.get(COPILOT_BRIEF_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["greeting"] == "Welcome"
    assert body["summary_markdown"] == "Complete your vendor profile to get personalised growth tips."
    assert body["growth_score"] == 0
    assert body["suggested_actions"] == [
        {
            "action_type": "edit_profile",
            "title": "Complete your profile",
            "rationale": "Finish onboarding so clients can find you.",
            "action_data": {},
            "href": "/vendor/profile",
        }
    ]
    assert body["demand_insights"] == []
    assert body["context_fingerprint"] == "profile_missing"
    assert body["narration_cached"] is False


def test_copilot_brief_with_a_profile_returns_fallback_narration_without_openai(admin_db: LocalDatabase) -> None:
    """A minimal, empty-payload vendor profile: deterministic actions plus the fixed fallback copy.

    BASELINE QUIRK: `build_daily_brief` swallows any OpenAI failure inside
    `_generate_narration_llm` and always falls back to `_fallback_narration`, so this
    route never surfaces a 503 the way the other AI routes do - with no OpenAI key it
    silently always serves the deterministic fallback text.
    """
    account = _seed_vendor(admin_db, "brief-empty")
    browser = sign_in(account)
    response = browser.get(COPILOT_BRIEF_URL)
    assert response.status_code == 200
    body = response.json()

    # Empty payload -> no profile image/bio/packages/portfolio/services, no analytics,
    # payouts not verified, listing not visible: the deterministic Growth Score is 34/100.
    assert body["growth_score"] == 34
    assert body["greeting"] == "Good to see you, Your business"
    assert body["summary_markdown"] == (
        "**Growth Score: 34/100**\n\n"
        "## Today's focus\n"
        "- Set up payouts\n\n"
        "## Keep momentum\n"
        "- Reply quickly to enquiries\n"
        "- Keep packages clear and portfolio photos fresh"
    )
    assert [action["title"] for action in body["suggested_actions"]] == [
        "Set up payouts",
        "Improve your listing",
        "Review your funnel",
    ]
    assert body["demand_insights"] == []
    assert body["narration_cached"] is False


# ---------------------------------------------------------------------------
# /api/v1/vendor/copilot/draft-reply
# ---------------------------------------------------------------------------


def test_copilot_draft_reply_without_a_session_is_401() -> None:
    """POST /vendor/copilot/draft-reply requires sign-in."""
    with new_browser() as browser:
        response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": MISSING_BOOKING_ID})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_copilot_draft_reply_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot draft vendor enquiry replies."""
    account = seed_account(admin_db, unique_email("draft-client"), "client")
    browser = sign_in(account)
    response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": MISSING_BOOKING_ID})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_copilot_draft_reply_missing_booking_id_is_422(admin_db: LocalDatabase) -> None:
    """`booking_request_id` has `min_length=1`, so the literal empty string fails validation."""
    account = seed_account(admin_db, unique_email("draft-empty-id"), "vendor")
    browser = sign_in(account)
    response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": ""})
    assert response.status_code == 422


def test_copilot_draft_reply_booking_not_found_returns_placeholder(admin_db: LocalDatabase) -> None:
    """A syntactically valid but unknown booking id never reaches OpenAI: a fixed placeholder, 200.

    BASELINE QUIRK: this looks like it should be a 404, but `draft_enquiry_reply` returns
    a normal 200 with an empty draft message and a "Booking not found." tip instead.
    """
    account = seed_account(admin_db, unique_email("draft-notfound"), "vendor")
    browser = sign_in(account)
    response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": MISSING_BOOKING_ID})
    assert response.status_code == 200
    assert response.json() == {"draft_message": "", "tips": [BOOKING_NOT_FOUND_TIP]}


def test_copilot_draft_reply_existing_booking_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """A real booking this vendor owns reaches `require_openai_client` and fails: 503.

    The route's own `except Exception` fallback (`DRAFT_REPLY_UNAVAILABLE`) never fires
    here: `require_openai_client` already raises an `HTTPException`, and the route lets
    any `HTTPException` through unchanged, so the detail is `OPENAI_UNAVAILABLE`.
    """
    client_account = seed_account(admin_db, unique_email("draft-booking-client"), "client")
    vendor_account = seed_account(admin_db, unique_email("draft-booking-vendor"), "vendor")
    booking_id = _seed_booking_request(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(vendor_account)
    response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": booking_id})
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


def test_copilot_draft_reply_another_vendors_booking_is_treated_as_not_found(admin_db: LocalDatabase) -> None:
    """`get_booking_request_for_vendor` scopes by `vendor_user_id`: another vendor's booking

    is indistinguishable from an unknown id, so this is the same 200 placeholder, not a
    403/404 - the endpoint never confirms whether the booking id exists at all.
    """
    client_account = seed_account(admin_db, unique_email("draft-other-client"), "client")
    owner_account = seed_account(admin_db, unique_email("draft-other-owner"), "vendor")
    other_vendor_account = seed_account(admin_db, unique_email("draft-other-vendor"), "vendor")
    booking_id = _seed_booking_request(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=owner_account.user_id
    )
    browser = sign_in(other_vendor_account)
    response = browser.post(COPILOT_DRAFT_REPLY_URL, json={"booking_request_id": booking_id})
    assert response.status_code == 200
    assert response.json() == {"draft_message": "", "tips": [BOOKING_NOT_FOUND_TIP]}


# ---------------------------------------------------------------------------
# /api/v1/vendor/copilot/review-packages
# ---------------------------------------------------------------------------


def test_copilot_review_packages_without_a_session_is_401() -> None:
    """POST /vendor/copilot/review-packages requires sign-in."""
    with new_browser() as browser:
        response = browser.post(COPILOT_REVIEW_PACKAGES_URL, json={"profile_form_data": {}})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_copilot_review_packages_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot use the post-launch package coach."""
    account = seed_account(admin_db, unique_email("copkg-client"), "client")
    browser = sign_in(account)
    response = browser.post(COPILOT_REVIEW_PACKAGES_URL, json={"profile_form_data": {}})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_copilot_review_packages_without_openai_key_is_503(admin_db: LocalDatabase) -> None:
    """The copilot's package review is the same engine as onboarding's: 503, unwrapped.

    BASELINE QUIRK: unlike `draft-reply`, this route has no try/except of its own, so
    `require_openai_client`'s `HTTPException` reaches the client exactly as raised - same
    503/`OPENAI_UNAVAILABLE` shape as the onboarding version of this call.
    """
    account = seed_account(admin_db, unique_email("copkg-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(
        COPILOT_REVIEW_PACKAGES_URL,
        json={"profile_form_data": {"packages": [{"title": "Package 1", "price": "100"}]}},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


# ---------------------------------------------------------------------------
# /api/v1/vendor/copilot/score
# ---------------------------------------------------------------------------


def test_copilot_score_without_a_session_is_401() -> None:
    """GET /vendor/copilot/score requires sign-in."""
    with new_browser() as browser:
        response = browser.get(COPILOT_SCORE_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_copilot_score_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client account cannot fetch a vendor Growth Score."""
    account = seed_account(admin_db, unique_email("score-client"), "client")
    browser = sign_in(account)
    response = browser.get(COPILOT_SCORE_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_copilot_score_without_a_vendor_profile_returns_zero(admin_db: LocalDatabase) -> None:
    """No `vendors` row at all: a fixed zero score, no levers - deterministic, no OpenAI."""
    account = seed_account(admin_db, unique_email("score-noprofile"), "vendor")
    browser = sign_in(account)
    response = browser.get(COPILOT_SCORE_URL)
    assert response.status_code == 200
    assert response.json() == {
        "score": 0,
        "levers": [],
        "listing_visible": False,
        "payouts_verified": False,
    }


def test_copilot_score_computes_deterministic_growth_score_from_profile(admin_db: LocalDatabase) -> None:
    """`compute_growth_score` is pure Python: an empty-payload profile scores exactly 34/100.

    Every lever is at its "nothing filled in yet" floor (no profile photo/bio/packages,
    no analytics history, no availability), except response speed and reviews, whose
    floors are non-zero defaults (`resp_pts=12.0`, `review_pts=8.0`) rather than zero.
    """
    account = _seed_vendor(admin_db, "score-empty")
    browser = sign_in(account)
    response = browser.get(COPILOT_SCORE_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 34
    assert body["listing_visible"] is False
    assert body["payouts_verified"] is False
    levers_by_key = {lever["metric_key"]: lever for lever in body["levers"]}
    assert levers_by_key.keys() == {"listing", "response", "conversion", "reviews", "availability"}
    assert levers_by_key["listing"] == {
        "metric_key": "listing",
        "label": "Listing quality",
        "score": 0,
        "max_score": 100,
        "status": "needs_work",
        "tip": "Add a profile photo. Clients trust listings with a face or logo.",
    }
    assert levers_by_key["response"]["score"] == 48
    assert levers_by_key["response"]["status"] == "ok"
    assert levers_by_key["conversion"]["score"] == 40
    assert levers_by_key["conversion"]["status"] == "needs_work"
    assert levers_by_key["reviews"]["score"] == 53
    assert levers_by_key["reviews"]["status"] == "ok"
    assert levers_by_key["availability"]["score"] == 40
    assert levers_by_key["availability"]["status"] == "needs_work"
