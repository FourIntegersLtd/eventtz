"""Freeze: referral partners (creator sign-up links) and the vendor sign-ups they brought in.

Owned by the `referrals` slice. Staff create partners through the admin API; the
tests then plant `referral_attributions` rows directly (attribution itself
happens inside vendor sign-up, which the identity freeze covers). Every partner
this module creates has a unique slug and is removed at the end.
"""

from __future__ import annotations

import secrets
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from supabase import Client

from conftest import API
from support.accounts import SeededAccount, seed_account, unique_email

PUBLIC_SITE = "https://www.eventtz.com"
SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
LINK_NOT_FOUND = "Referral link not found"
PARTNER_NOT_FOUND = "Referral partner not found"
SIGNUP_NOT_FOUND = "Referral signup not found"
INVALID_SLUG = "Slug must use lowercase letters, numbers, and hyphens only."
DISPLAY_NAME_REQUIRED = "Display name is required."
DISPLAY_NAME_EMPTY = "Display name cannot be empty."
NO_FIELDS_TO_UPDATE = "No fields to update."
# A valid UUID that no partner or user will ever have.
MISSING_ID = "00000000-0000-4000-8000-000000000000"

PARTNERS_URL = f"{API}/admin/referrals/partners"


def unique_label() -> str:
    """Letters only, so it survives slug normalisation unchanged."""
    return "".join(secrets.choice("abcdefghijklmnopqrstuvwxyz") for _position in range(10))


@pytest.fixture(scope="module")
def created_partner_ids(admin_db: Client) -> Iterator[list[str]]:
    """Collects the id of every partner a test creates, and deletes them (and their sign-ups) afterwards."""
    partner_ids: list[str] = []
    yield partner_ids
    for partner_id in partner_ids:
        admin_db.table("referral_attributions").delete().eq("referral_partner_id", partner_id).execute()
        admin_db.table("referral_partners").delete().eq("id", partner_id).execute()


def create_partner(as_staff: httpx.Client, created_partner_ids: list[str], **fields: Any) -> dict[str, Any]:
    """Create a partner through the API and remember it for cleanup."""
    response = as_staff.post(PARTNERS_URL, json=fields)
    assert response.status_code == 200, response.text
    partner: dict[str, Any] = response.json()["partner"]
    created_partner_ids.append(partner["id"])
    return partner


# --- who may use the admin routes ----------------------------------------------------------


ADMIN_ROUTES = [
    ("GET", "/admin/referrals/partners", None),
    ("POST", "/admin/referrals/partners", {"display_name": "Nobody"}),
    ("PATCH", f"/admin/referrals/partners/{MISSING_ID}", {"notes": "x"}),
    ("GET", f"/admin/referrals/partners/{MISSING_ID}/signups", None),
    ("PATCH", f"/admin/referrals/signups/{MISSING_ID}", {"shoutout_completed": True}),
]


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ROUTES)
def test_admin_routes_need_a_session(anonymous: httpx.Client, method: str, path: str, body: Any) -> None:
    """Anonymous callers are asked to sign in."""
    response = anonymous.request(method, f"{API}{path}", json=body)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize(("method", "path", "body"), ADMIN_ROUTES)
@pytest.mark.parametrize("portal_fixture", ["as_client", "as_vendor"])
def test_admin_routes_are_staff_only(
    request: pytest.FixtureRequest,
    portal_fixture: str,
    method: str,
    path: str,
    body: Any,
) -> None:
    """Clients and vendors get the admin-portal refusal."""
    browser: httpx.Client = request.getfixturevalue(portal_fixture)
    response = browser.request(method, f"{API}{path}", json=body)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


# --- creating partners ---------------------------------------------------------------------------


def test_create_partner_derives_the_slug_and_link(
    as_staff: httpx.Client,
    staff_account: SeededAccount,
    created_partner_ids: list[str],
    admin_db: Client,
) -> None:
    """The slug comes from the display name; handles and notes are trimmed; the link is on the public site."""
    label = unique_label()
    partner = create_partner(
        as_staff,
        created_partner_ids,
        display_name=f"  Creator {label}  ",
        instagram_handle="  @creator  ",
        notes="  met at a fair  ",
    )
    assert partner["slug"] == f"creator-{label}"
    assert partner["display_name"] == f"Creator {label}"
    assert partner["instagram_handle"] == "@creator"
    assert partner["notes"] == "met at a fair"
    assert partner["is_active"] is True
    assert partner["referral_link"] == f"{PUBLIC_SITE}/vendor/register?ref=creator-{label}"
    assert partner["created_at"] and partner["updated_at"]
    stored = admin_db.table("referral_partners").select("*").eq("id", partner["id"]).execute().data[0]
    assert stored["created_by_admin_id"] == staff_account.user_id


def test_create_partner_numbers_a_taken_slug(as_staff: httpx.Client, created_partner_ids: list[str]) -> None:
    """A second partner with the same name gets `-2`, then `-3`."""
    label = unique_label()
    slugs = [
        create_partner(as_staff, created_partner_ids, display_name=f"Twin {label}")["slug"]
        for _copy in range(3)
    ]
    assert slugs == [f"twin-{label}", f"twin-{label}-2", f"twin-{label}-3"]


def test_create_partner_normalises_a_chosen_slug(
    as_staff: httpx.Client, created_partner_ids: list[str]
) -> None:
    """A chosen slug is lower-cased, accents folded, punctuation dropped and spaces hyphenated."""
    label = unique_label()
    partner = create_partner(
        as_staff,
        created_partner_ids,
        display_name="Ignored Name",
        slug=f"  Café {label.upper()}!!  ",
    )
    assert partner["slug"] == f"cafe-{label}"


def test_blank_chosen_slug_falls_back_to_the_display_name(
    as_staff: httpx.Client, created_partner_ids: list[str]
) -> None:
    """Whitespace-only slugs are ignored."""
    label = unique_label()
    partner = create_partner(as_staff, created_partner_ids, display_name=f"Fallback {label}", slug="   ")
    assert partner["slug"] == f"fallback-{label}"


def test_create_partner_rejects_a_slug_that_cannot_be_made_valid(
    as_staff: httpx.Client,
) -> None:
    """Underscores survive normalisation but break the slug format."""
    response = as_staff.post(PARTNERS_URL, json={"display_name": "Name", "slug": "under_score"})
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_SLUG


def test_create_partner_needs_a_display_name(as_staff: httpx.Client) -> None:
    """Whitespace passes the length check but is refused; empty and missing are shape errors."""
    blank = as_staff.post(PARTNERS_URL, json={"display_name": "   "})
    assert blank.status_code == 400
    assert blank.json()["detail"] == DISPLAY_NAME_REQUIRED
    assert as_staff.post(PARTNERS_URL, json={"display_name": ""}).status_code == 422
    assert as_staff.post(PARTNERS_URL, json={}).status_code == 422
    assert as_staff.post(PARTNERS_URL, json={"display_name": "x" * 121}).status_code == 422


def test_list_partners_newest_first(as_staff: httpx.Client, created_partner_ids: list[str]) -> None:
    """The newest partner is first, in the same shape as create returns."""
    newest = create_partner(as_staff, created_partner_ids, display_name=f"Newest {unique_label()}")
    response = as_staff.get(PARTNERS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["partners"][0] == newest


# --- editing partners ------------------------------------------------------------------------


def test_update_partner_changes_only_the_fields_sent(
    as_staff: httpx.Client, created_partner_ids: list[str]
) -> None:
    """The slug never changes; blank handles and notes become null."""
    partner = create_partner(
        as_staff,
        created_partner_ids,
        display_name=f"Editable {unique_label()}",
        instagram_handle="@a",
        notes="n",
    )
    response = as_staff.patch(
        f"{PARTNERS_URL}/{partner['id']}",
        json={"display_name": "  Renamed  ", "instagram_handle": "  "},
    )
    assert response.status_code == 200
    updated = response.json()["partner"]
    assert updated["display_name"] == "Renamed"
    assert updated["instagram_handle"] is None
    assert updated["notes"] == "n"
    assert updated["slug"] == partner["slug"]
    cleared = as_staff.patch(f"{PARTNERS_URL}/{partner['id']}", json={"notes": ""}).json()["partner"]
    assert cleared["notes"] is None


def test_update_partner_refusals(as_staff: httpx.Client, created_partner_ids: list[str]) -> None:
    """Nothing to change, a blank name, or an unknown partner."""
    partner = create_partner(as_staff, created_partner_ids, display_name=f"Refusals {unique_label()}")
    url = f"{PARTNERS_URL}/{partner['id']}"
    for body in ({}, {"notes": None}):
        response = as_staff.patch(url, json=body)
        assert response.status_code == 400
        assert response.json()["detail"] == NO_FIELDS_TO_UPDATE
    blank_name = as_staff.patch(url, json={"display_name": "   "})
    assert blank_name.status_code == 400
    assert blank_name.json()["detail"] == DISPLAY_NAME_EMPTY
    missing = as_staff.patch(f"{PARTNERS_URL}/{MISSING_ID}", json={"notes": "x"})
    assert missing.status_code == 404
    assert missing.json()["detail"] == PARTNER_NOT_FOUND


# --- the public register-page banner ----------------------------------------------------------------


def test_public_lookup_finds_active_partners_by_slug(
    anonymous: httpx.Client, as_staff: httpx.Client, created_partner_ids: list[str]
) -> None:
    """The register page shows the partner's name; the slug is normalised first."""
    label = unique_label()
    partner = create_partner(as_staff, created_partner_ids, display_name=f"Banner {label}")
    for requested_slug in (partner["slug"], partner["slug"].upper()):
        response = anonymous.get(f"{API}/referrals/partners/{requested_slug}")
        assert response.status_code == 200
        assert response.json() == {
            "success": True,
            "slug": partner["slug"],
            "display_name": f"Banner {label}",
        }


def test_public_lookup_hides_inactive_and_unknown_partners(
    anonymous: httpx.Client, as_staff: httpx.Client, created_partner_ids: list[str]
) -> None:
    """A switched-off link and a made-up slug look the same."""
    partner = create_partner(as_staff, created_partner_ids, display_name=f"Retired {unique_label()}")
    switched_off = as_staff.patch(f"{PARTNERS_URL}/{partner['id']}", json={"is_active": False})
    assert switched_off.json()["partner"]["is_active"] is False
    for slug in (partner["slug"], f"never-{unique_label()}", "under_score"):
        response = anonymous.get(f"{API}/referrals/partners/{slug}")
        assert response.status_code == 404
        assert response.json()["detail"] == LINK_NOT_FOUND


# --- sign-ups a partner brought in ------------------------------------------------------------


@pytest.fixture(scope="module")
def partner_with_signups(
    admin_db: Client, as_staff: httpx.Client, created_partner_ids: list[str]
) -> Iterator[dict[str, Any]]:
    """A partner with three attributed vendors (oldest first), one with a finished shout-out.

    Yields `{"partner": ..., "vendors": [SeededAccount, ...], "business_name": ...}`;
    the vendor rows and accounts are deleted afterwards (business names are unique
    across all vendors, so the name carries the run's label).
    """
    label = unique_label()
    partner = create_partner(as_staff, created_partner_ids, display_name=f"Signups {label}")
    vendors = [seed_account(admin_db, unique_email(f"ref-signup-{index}"), "vendor") for index in range(3)]
    admin_db.table("vendors").insert(
        [
            {
                "user_id": vendors[0].user_id,
                "status": "complete",
                "approval_status": "approved",
                "payload": {"businessName": f"  Sunny Cakes {label}  "},
            },
            # A bulk insert sends every key for every row, so column defaults must be spelled out.
            {
                "user_id": vendors[1].user_id,
                "status": "draft",
                "approval_status": "pending",
                "payload": {"businessName": "   "},
            },
        ]
    ).execute()
    admin_db.table("referral_attributions").insert(
        [
            {
                "user_id": vendor.user_id,
                "referral_partner_id": partner["id"],
                "referral_slug": partner["slug"],
                "attributed_at": f"2030-01-0{index + 1}T10:00:00+00:00",
                "shoutout_completed": index == 1,
                "shoutout_completed_at": "2030-02-01T10:00:00+00:00" if index == 1 else None,
            }
            for index, vendor in enumerate(vendors)
        ]
    ).execute()
    yield {
        "partner": partner,
        "vendors": vendors,
        "business_name": f"Sunny Cakes {label}",
    }
    for vendor in vendors:
        admin_db.table("vendors").delete().eq("user_id", vendor.user_id).execute()
        admin_db.auth.admin.delete_user(vendor.user_id)


def test_signups_list_newest_first_with_vendor_details(
    as_staff: httpx.Client, partner_with_signups: dict[str, Any]
) -> None:
    """Each sign-up shows the vendor's email, business name, statuses and browse path."""
    partner = partner_with_signups["partner"]
    vendors: list[SeededAccount] = partner_with_signups["vendors"]
    response = as_staff.get(f"{PARTNERS_URL}/{partner['id']}/signups")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["partner"]["id"] == partner["id"]
    assert (body["total"], body["offset"], body["limit"]) == (3, 0, 50)
    assert [signup["user_id"] for signup in body["signups"]] == [
        vendor.user_id for vendor in reversed(vendors)
    ]
    by_user = {signup["user_id"]: signup for signup in body["signups"]}
    approved = by_user[vendors[0].user_id]
    assert approved == {
        "user_id": vendors[0].user_id,
        "email": vendors[0].email,
        "business_name": partner_with_signups["business_name"],
        "approval_status": "approved",
        "onboarding_status": "complete",
        "attributed_at": approved["attributed_at"],
        "shoutout_completed": False,
        "shoutout_completed_at": None,
        "explore_path": f"/client/browse/{vendors[0].user_id}",
    }
    assert approved["attributed_at"].startswith("2030-01-01T10:00:00")
    assert by_user[vendors[1].user_id]["business_name"] is None
    assert by_user[vendors[1].user_id]["approval_status"] == "pending"
    assert by_user[vendors[1].user_id]["shoutout_completed"] is True
    no_profile = by_user[vendors[2].user_id]
    assert (
        no_profile["business_name"],
        no_profile["approval_status"],
        no_profile["onboarding_status"],
    ) == (
        None,
        None,
        None,
    )


def test_signups_filter_and_page(as_staff: httpx.Client, partner_with_signups: dict[str, Any]) -> None:
    """`shoutout` filters; `offset`/`limit` page; `total` counts the filtered set."""
    partner = partner_with_signups["partner"]
    vendors: list[SeededAccount] = partner_with_signups["vendors"]
    url = f"{PARTNERS_URL}/{partner['id']}/signups"
    completed = as_staff.get(url, params={"shoutout": "completed"}).json()
    assert completed["total"] == 1
    assert [signup["user_id"] for signup in completed["signups"]] == [vendors[1].user_id]
    pending = as_staff.get(url, params={"shoutout": "pending"}).json()
    assert pending["total"] == 2
    page = as_staff.get(url, params={"offset": 1, "limit": 1}).json()
    assert (page["total"], page["offset"], page["limit"]) == (3, 1, 1)
    assert [signup["user_id"] for signup in page["signups"]] == [vendors[1].user_id]
    # Not frozen: an offset past the end is a 500 on the baseline (PostgREST's
    # "range not satisfiable" escapes). api/ returns an empty page instead.


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"offset": -1}, {"shoutout": "sometimes"}])
def test_signups_query_validation(as_staff: httpx.Client, params: dict[str, Any]) -> None:
    """Out-of-range paging and unknown filters are shape errors."""
    response = as_staff.get(f"{PARTNERS_URL}/{MISSING_ID}/signups", params=params)
    assert response.status_code == 422


def test_signups_for_an_unknown_partner(as_staff: httpx.Client) -> None:
    """404 rather than an empty list."""
    response = as_staff.get(f"{PARTNERS_URL}/{MISSING_ID}/signups")
    assert response.status_code == 404
    assert response.json()["detail"] == PARTNER_NOT_FOUND


def test_marking_a_shoutout_done_and_undone(
    as_staff: httpx.Client, partner_with_signups: dict[str, Any]
) -> None:
    """Completing stamps the time; un-completing clears it. The row comes back in list shape."""
    vendor: SeededAccount = partner_with_signups["vendors"][0]
    url = f"{API}/admin/referrals/signups/{vendor.user_id}"
    done = as_staff.patch(url, json={"shoutout_completed": True})
    assert done.status_code == 200
    assert done.json()["shoutout_completed"] is True
    assert done.json()["shoutout_completed_at"]
    assert done.json()["business_name"] == partner_with_signups["business_name"]
    assert done.json()["email"] == vendor.email
    undone = as_staff.patch(url, json={"shoutout_completed": False}).json()
    assert (undone["shoutout_completed"], undone["shoutout_completed_at"]) == (
        False,
        None,
    )


def test_marking_an_unknown_signup(as_staff: httpx.Client) -> None:
    """A user with no attribution is a 404; the flag is required."""
    missing = as_staff.patch(
        f"{API}/admin/referrals/signups/{uuid.uuid4()}",
        json={"shoutout_completed": True},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == SIGNUP_NOT_FOUND
    assert as_staff.patch(f"{API}/admin/referrals/signups/{MISSING_ID}", json={}).status_code == 422
