"""Freeze: the vendor's own profile screen (load, save, submit, business-name check).

Owned by the `vendors` slice, mounted at `/api/v1/vendor`. Every mutating test seeds a
fresh vendor account with `seed_account` so runs stay independent of each other.
"""

from __future__ import annotations

import uuid

import httpx
from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
BUSINESS_NAME_ALREADY_REGISTERED = "This business name is already registered."
STEP_LOCATION_BASE_CITY_REQUIRED = "Step location: base city is required."

PROFILE_URL = f"{API}/vendor/profile"
BUSINESS_NAME_AVAILABLE_URL = f"{API}/vendor/profile/business-name-available"

# The bucket/region api/'s settings default to (acceptance/scripts/serve.sh only blanks the AWS keys).
S3_HOST = "eventtz.s3.eu-west-2.amazonaws.com"


def _s3_url(user_id: str, name: str) -> str:
    """A URL that `is_our_s3_url` accepts as this vendor's own upload, without touching S3."""
    return f"https://{S3_HOST}/users/{user_id}/{name}"


def _assert_error_code(body: dict[str, object], api_code: str) -> None:
    """api/ gives every error a stable `code` (ADR 0004); the old backend sent none."""
    assert body["code"] == api_code


def _unique_business_name(label: str) -> str:
    """A business name no other test run has used, so saves never clash."""
    return f"Acceptance {label} {uuid.uuid4().hex[:8]}"


def _fresh_vendor(admin_db: LocalDatabase, label: str) -> tuple[httpx.Client, str]:
    """A brand-new vendor account, signed in, and its user id."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    return sign_in(account), account.user_id


def _full_submit_payload(user_id: str, business_name: str) -> dict[str, object]:
    """A payload that satisfies every onboarding step's submit-time checks (steps 1-8)."""
    return {
        "businessName": business_name,
        "firstName": "Ada",
        "lastName": "Lovelace",
        "phone": "07700 900123",
        "countryCode": "GB",
        "baseCity": "London",
        "deliveryModes": ["vendor_travels"],
        "travelRadius": "10",
        "travelDeliveryPolicy": "flat_fee",
        "servicesOffered": ["photography"],
        "hourlyRate": "50",
        "availableWeekdays": ["mon", "tue"],
        "maxBookingsPerDay": "3",
        "profileImageUrl": _s3_url(user_id, "profile.jpg"),
        "portfolioFileNames": [_s3_url(user_id, f"portfolio-{index}.jpg") for index in range(5)],
    }


def test_get_profile_without_a_session_is_401() -> None:
    """GET /vendor/profile requires sign-in."""
    with new_browser() as browser:
        response = browser.get(PROFILE_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_profile_defaults_when_there_is_no_vendor_row(admin_db: LocalDatabase) -> None:
    """A brand-new vendor with no `vendors` row yet gets the step-1 draft default."""
    browser, _user_id = _fresh_vendor(admin_db, "profile-get-default")
    response = browser.get(PROFILE_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["current_step"] == 1
    assert body["onboarding_status"] == "draft"
    assert body["approval_status"] == "pending"
    assert body["profile_form_data"] == {}
    assert body["payouts_verified"] is False
    assert body["listing_visible"] is False


def test_get_profile_is_reachable_by_a_signed_in_client(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: GET/PUT /vendor/profile are guarded with `require_user`, not
    `require_vendor` (unlike /vendor/profile/business-name-available below), so any
    signed-in account - including a client - can read the vendor-profile default.
    """
    account = seed_account(admin_db, unique_email("profile-get-client"), "client")
    browser = sign_in(account)
    response = browser.get(PROFILE_URL)
    assert response.status_code == 200
    assert response.json()["current_step"] == 1


def test_put_profile_by_a_client_flips_their_user_type_to_vendor(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: because PUT /vendor/profile only requires `require_user`, a client
    who calls it gets a `vendors` row created for them, and `upsert_vendor_profile`
    unconditionally upserts `public.users.user_type` to "vendor" for the caller - silently
    converting their account type.
    """
    account = seed_account(admin_db, unique_email("profile-put-client"), "client")
    browser = sign_in(account)
    response = browser.put(
        PROFILE_URL,
        json={
            "current_step": 1,
            "profile_form_data": {"businessName": _unique_business_name("ClientTurnedVendor")},
        },
    )
    assert response.status_code == 200
    row = admin_db.table("users").select("user_type").eq("id", account.user_id).execute().data[0]
    assert row["user_type"] == "vendor"


def test_business_name_available_without_a_session_is_401() -> None:
    """GET /vendor/profile/business-name-available requires sign-in."""
    with new_browser() as browser:
        response = browser.get(BUSINESS_NAME_AVAILABLE_URL, params={"business_name": "Anything"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_business_name_available_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """Unlike GET/PUT /vendor/profile, the business-name check is `require_vendor`-gated."""
    account = seed_account(admin_db, unique_email("bn-client"), "client")
    browser = sign_in(account)
    response = browser.get(BUSINESS_NAME_AVAILABLE_URL, params={"business_name": "Anything"})
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_business_name_available_true_for_an_unused_name(admin_db: LocalDatabase) -> None:
    """A name nobody has registered is reported available."""
    browser, _user_id = _fresh_vendor(admin_db, "bn-available")
    name = _unique_business_name("Available")
    response = browser.get(BUSINESS_NAME_AVAILABLE_URL, params={"business_name": name})
    assert response.status_code == 200
    assert response.json() == {"success": True, "available": True}


def test_business_name_available_false_case_and_whitespace_insensitive(admin_db: LocalDatabase) -> None:
    """The uniqueness check normalizes case and repeated whitespace before comparing."""
    owner, owner_id = _fresh_vendor(admin_db, "bn-owner")
    name = _unique_business_name("Taken")
    saved = owner.put(PROFILE_URL, json={"current_step": 1, "profile_form_data": {"businessName": name}})
    assert saved.status_code == 200

    checker, _checker_id = _fresh_vendor(admin_db, "bn-checker")
    loud_and_spaced = f"  {name.upper().replace(' ', '   ')}  "
    response = checker.get(BUSINESS_NAME_AVAILABLE_URL, params={"business_name": loud_and_spaced})
    assert response.status_code == 200
    assert response.json()["available"] is False

    # The owner checking their own (unchanged) name is excluded from the match.
    own_check = owner.get(BUSINESS_NAME_AVAILABLE_URL, params={"business_name": name})
    assert own_check.json()["available"] is True
    assert owner_id  # sanity: the fixture returned a real id


def test_put_profile_without_a_session_is_401() -> None:
    """PUT /vendor/profile requires sign-in."""
    with new_browser() as browser:
        response = browser.put(PROFILE_URL, json={"current_step": 1, "profile_form_data": {}})
    assert response.status_code == 401


def test_put_profile_saves_a_draft_step_one(admin_db: LocalDatabase) -> None:
    """Saving step 1 as a draft persists the step, status and payload fields given."""
    browser, _user_id = _fresh_vendor(admin_db, "put-draft")
    response = browser.put(
        PROFILE_URL,
        json={
            "current_step": 1,
            "profile_form_data": {"firstName": "Ada", "lastName": "Lovelace", "phone": "07700 900123"},
            "status": "draft",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current_step"] == 1
    assert body["onboarding_status"] == "draft"
    assert body["profile_form_data"]["firstName"] == "Ada"
    assert body["profile_form_data"]["lastName"] == "Lovelace"


def test_put_profile_merges_the_payload_over_the_existing_one(admin_db: LocalDatabase) -> None:
    """A later PUT with only some fields keeps the fields from the earlier save."""
    browser, _user_id = _fresh_vendor(admin_db, "put-merge")
    first = browser.put(
        PROFILE_URL,
        json={"current_step": 1, "profile_form_data": {"firstName": "Ada", "lastName": "Lovelace"}},
    )
    assert first.status_code == 200

    second = browser.put(
        PROFILE_URL,
        json={"current_step": 1, "profile_form_data": {"lastName": "King"}},
    )
    assert second.status_code == 200
    merged = second.json()["profile_form_data"]
    assert merged["firstName"] == "Ada"
    assert merged["lastName"] == "King"


def test_put_profile_clamps_the_bio_to_one_hundred_words(admin_db: LocalDatabase) -> None:
    """A bio draft over 100 words is clamped to 100 words plus an ellipsis on save."""
    browser, _user_id = _fresh_vendor(admin_db, "put-bio")
    long_bio = " ".join(f"word{index}" for index in range(150))
    response = browser.put(
        PROFILE_URL,
        json={"current_step": 1, "profile_form_data": {"aiBioDraft": long_bio}},
    )
    assert response.status_code == 200
    saved_bio = response.json()["profile_form_data"]["aiBioDraft"]
    assert saved_bio.endswith("…")
    assert len(saved_bio[:-1].split()) == 100
    assert saved_bio.startswith("word0 word1 word2")


def test_put_profile_advancing_a_step_with_missing_fields_is_a_validation_error(
    admin_db: LocalDatabase,
) -> None:
    """Advancing past step 3 (location) without its required fields is rejected with the
    first missing field's message (and, on api/ only, a stable `code`).
    """
    browser, _user_id = _fresh_vendor(admin_db, "put-validation")
    first = browser.put(
        PROFILE_URL,
        json={
            "current_step": 1,
            "profile_form_data": {"firstName": "Ada", "lastName": "Lovelace", "phone": "07700 900123"},
        },
    )
    assert first.status_code == 200

    response = browser.put(PROFILE_URL, json={"current_step": 4, "profile_form_data": {}})
    assert response.status_code == 400
    body = response.json()
    assert body["detail"] == STEP_LOCATION_BASE_CITY_REQUIRED
    _assert_error_code(body, "vendor_profile_invalid")


def test_put_profile_business_name_conflict_is_409(admin_db: LocalDatabase) -> None:
    """Saving a business name already taken by another vendor is refused as a conflict."""
    owner, _owner_id = _fresh_vendor(admin_db, "bn-conflict-owner")
    name = _unique_business_name("Conflict")
    taken = owner.put(PROFILE_URL, json={"current_step": 1, "profile_form_data": {"businessName": name}})
    assert taken.status_code == 200

    challenger, _challenger_id = _fresh_vendor(admin_db, "bn-conflict-challenger")
    response = challenger.put(
        PROFILE_URL,
        json={"current_step": 1, "profile_form_data": {"businessName": name}},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["detail"] == BUSINESS_NAME_ALREADY_REGISTERED
    _assert_error_code(body, "business_name_taken")


def test_put_profile_submit_with_a_complete_payload_marks_it_submitted(admin_db: LocalDatabase) -> None:
    """A payload that satisfies every onboarding step can be submitted for review."""
    browser, user_id = _fresh_vendor(admin_db, "put-submit")
    business_name = _unique_business_name("Submit")
    response = browser.put(
        PROFILE_URL,
        json={
            "current_step": 8,
            "profile_form_data": _full_submit_payload(user_id, business_name),
            "status": "submitted",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["onboarding_status"] == "submitted"
    assert body["approval_status"] == "pending"
    assert body["profile_form_data"]["businessName"] == business_name

    row = admin_db.table("vendors").select("status,approval_status").eq("user_id", user_id).execute().data[0]
    assert row["status"] == "submitted"
    assert row["approval_status"] == "pending"


def test_put_profile_current_step_out_of_range_is_a_pydantic_validation_error(
    admin_db: LocalDatabase,
) -> None:
    """`current_step` is bounded 1-20 by the request model, checked before any handler code."""
    browser, _user_id = _fresh_vendor(admin_db, "put-step-range")
    response = browser.put(PROFILE_URL, json={"current_step": 21, "profile_form_data": {}})
    assert response.status_code == 422
