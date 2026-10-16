"""Freeze: vendor client-referral codes, the public fee-discount preview, and referral bookings.

Owned by the `referrals` slice. An approved vendor picks (or is given) a 1-6 digit
code; clients who book with it pay a smaller Eventtz service fee once the vendor's
portion reaches a tier (£400 → £10 off, £600 → £15 off). Every vendor, client and
booking here is created fresh with unique codes and removed at the end; the shared
`vendor_account` deliberately has no `vendors` row.
"""

from __future__ import annotations

import secrets
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import pytest
from support.database import LocalDatabase

from conftest import API, sign_in
from support.accounts import SeededAccount, close_account, seed_account, unique_email

PUBLIC_SITE = "https://www.eventtz.com"
SIGN_IN_REQUIRED = "Please sign in to continue."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
REFERRAL_NOT_FOUND = "Referral code not found."
REFERRAL_CODE_LOCKED = (
    "Your referral code is already set and cannot be changed. Share your existing link or code with clients."
)
REFERRAL_CODE_FORMAT_INVALID = "Referral codes must be 1 to 6 digits."
REFERRAL_CODE_TAKEN = "That code is already in use. Try another."
FEE_TIERS = [
    {"min_spend_gbp": 600.0, "fee_discount_gbp": 15.0},
    {"min_spend_gbp": 400.0, "fee_discount_gbp": 10.0},
]

REFERRAL_URL = f"{API}/vendor/referral"
SET_CODE_URL = f"{API}/vendor/referral/code"
BOOKINGS_URL = f"{API}/vendor/referral/bookings"


def share_link(vendor: SeededAccount, code: str) -> str:
    """The client browse link a vendor shares, carrying their code."""
    return f"{PUBLIC_SITE}/client/browse/{vendor.user_id}?vref={code}"


def preview_url(vendor_user_id: str) -> str:
    """The public preview route for one vendor."""
    return f"{API}/vendors/explore/vendor/{vendor_user_id}/referral-preview"


def dashed(code: str) -> str:
    """The code with hyphens between digit pairs, as a client might type it."""
    return "-".join(code[start : start + 2] for start in range(0, len(code), 2))


@pytest.fixture(scope="module")
def unused_code(admin_db: LocalDatabase) -> Callable[[], str]:
    """Returns a function that picks a random six-digit code no vendor holds yet."""
    handed_out: set[str] = set()

    def pick() -> str:
        """A six-digit code not handed out yet in this test and not owned by any vendor."""
        while True:
            candidate = f"{secrets.randbelow(900_000) + 100_000}"
            if candidate in handed_out:
                continue
            holders = (
                admin_db.table("vendors").select("user_id").eq("client_referral_code", candidate).execute()
            )
            if not holders.data:
                handed_out.add(candidate)
                return candidate

    return pick


@pytest.fixture(scope="module")
def make_vendor(admin_db: LocalDatabase) -> Iterator[Callable[..., SeededAccount]]:
    """Returns a factory for vendors with a `vendors` row; deletes them and their bookings afterwards."""
    created: list[SeededAccount] = []

    def create(
        *,
        approval_status: str = "approved",
        code: str | None = None,
        enabled: bool = True,
    ) -> SeededAccount:
        """A vendor account with a `vendors` row in the given approval state, code and on/off switch."""
        vendor = seed_account(admin_db, unique_email("ref-vendor"), "vendor")
        admin_db.table("vendors").insert(
            {
                "user_id": vendor.user_id,
                "status": "complete",
                "approval_status": approval_status,
                "client_referral_code": code,
                "client_referral_enabled": enabled,
            }
        ).execute()
        created.append(vendor)
        return vendor

    yield create
    for vendor in created:
        admin_db.table("booking_requests").delete().eq("vendor_user_id", vendor.user_id).execute()
        admin_db.table("vendors").delete().eq("user_id", vendor.user_id).execute()
        admin_db.auth.admin.delete_user(vendor.user_id)


@pytest.fixture(scope="module")
def signed_in() -> Iterator[Callable[[SeededAccount], httpx.Client]]:
    """Returns a function that signs an account in; every browser is closed afterwards."""
    browsers: list[httpx.Client] = []

    def open_browser(account: SeededAccount) -> httpx.Client:
        """A signed-in client for the account, closed when the test ends."""
        browser = sign_in(account)
        browsers.append(browser)
        return browser

    yield open_browser
    for browser in browsers:
        browser.close()


# --- who may use the vendor routes -----------------------------------------------------------


VENDOR_ROUTES = [
    ("GET", REFERRAL_URL, None),
    ("POST", SET_CODE_URL, {}),
    ("GET", BOOKINGS_URL, None),
]


@pytest.mark.parametrize(("method", "url", "body"), VENDOR_ROUTES)
def test_vendor_routes_need_a_session(anonymous: httpx.Client, method: str, url: str, body: Any) -> None:
    """Anonymous callers are asked to sign in."""
    response = anonymous.request(method, url, json=body)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize(("method", "url", "body"), VENDOR_ROUTES)
def test_vendor_routes_refuse_clients(as_client: httpx.Client, method: str, url: str, body: Any) -> None:
    """Clients get the vendor-portal refusal."""
    response = as_client.request(method, url, json=body)
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_vendor_without_a_profile_has_no_referral_programme(
    as_vendor: httpx.Client,
) -> None:
    """No `vendors` row: nothing to show, nothing to set, and an empty bookings list."""
    info = as_vendor.get(REFERRAL_URL)
    assert info.status_code == 404
    assert info.json()["detail"] == REFERRAL_NOT_FOUND
    set_code = as_vendor.post(SET_CODE_URL, json={"code": "123"})
    assert set_code.status_code == 400
    assert set_code.json()["detail"] == REFERRAL_NOT_FOUND
    bookings = as_vendor.get(BOOKINGS_URL)
    assert bookings.status_code == 200
    assert bookings.json() == {
        "success": True,
        "total_referral_bookings": 0,
        "total_fee_savings_gbp": 0.0,
        "bookings": [],
    }


def test_unapproved_vendors_cannot_use_codes(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
    unused_code: Callable[[], str],
) -> None:
    """Pending vendors see and set nothing, even when a code is already stored."""
    browser = signed_in(make_vendor(approval_status="pending", code=unused_code()))
    info = browser.get(REFERRAL_URL)
    assert info.status_code == 404
    assert info.json()["detail"] == REFERRAL_NOT_FOUND
    set_code = browser.post(SET_CODE_URL, json={})
    assert set_code.status_code == 400
    assert set_code.json()["detail"] == REFERRAL_NOT_FOUND


# --- reading and setting a code ------------------------------------------------------------------


def test_approved_vendor_without_a_code(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
) -> None:
    """The programme is shown with its tiers but no code or link yet."""
    browser = signed_in(make_vendor())
    response = browser.get(REFERRAL_URL)
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "referral_code": "",
        "has_referral_code": False,
        "share_link": "",
        "service_fee_percent": 5.0,
        "tiers": FEE_TIERS,
        "enabled": True,
    }


def test_generating_a_code_then_it_is_locked(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
) -> None:
    """A blank code generates six random digits; after that only the same code is accepted."""
    vendor = make_vendor()
    browser = signed_in(vendor)
    generated = browser.post(SET_CODE_URL, json={"code": "   "})
    assert generated.status_code == 200
    code = generated.json()["referral_code"]
    assert len(code) == 6 and code.isdigit()
    assert generated.json() == {
        "success": True,
        "referral_code": code,
        "share_link": share_link(vendor, code),
    }

    info = browser.get(REFERRAL_URL).json()
    assert (info["referral_code"], info["has_referral_code"], info["share_link"]) == (
        code,
        True,
        share_link(vendor, code),
    )

    for locked_body in ({}, {"code": None}, {"generate": True}, {"code": "1"}):
        locked = browser.post(SET_CODE_URL, json=locked_body)
        assert locked.status_code == 400
        assert locked.json()["detail"] == REFERRAL_CODE_LOCKED
    for same_code in (code, dashed(code)):
        again = browser.post(SET_CODE_URL, json={"code": same_code})
        assert again.status_code == 200
        assert again.json()["referral_code"] == code


def test_choosing_a_code(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
    unused_code: Callable[[], str],
) -> None:
    """Non-digits are stripped; `generate` is ignored when a code is given."""
    vendor = make_vendor()
    browser = signed_in(vendor)
    chosen = unused_code()
    response = browser.post(SET_CODE_URL, json={"code": f" {dashed(chosen)} ", "generate": True})
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "referral_code": chosen,
        "share_link": share_link(vendor, chosen),
    }


def test_choosing_an_invalid_or_taken_code(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
    unused_code: Callable[[], str],
) -> None:
    """Too many digits, no digits at all, or another vendor's code."""
    taken = unused_code()
    make_vendor(code=taken)
    browser = signed_in(make_vendor())
    for bad_code in ("1234567", "abc", "--"):
        response = browser.post(SET_CODE_URL, json={"code": bad_code})
        assert response.status_code == 400
        assert response.json()["detail"] == REFERRAL_CODE_FORMAT_INVALID
    clash = browser.post(SET_CODE_URL, json={"code": taken})
    assert clash.status_code == 400
    assert clash.json()["detail"] == REFERRAL_CODE_TAKEN
    assert browser.get(REFERRAL_URL).json()["has_referral_code"] is False


def test_disabled_codes_are_still_shown(
    make_vendor: Callable[..., SeededAccount],
    signed_in: Callable[[SeededAccount], httpx.Client],
    unused_code: Callable[[], str],
) -> None:
    """A switched-off code is still the vendor's; `enabled` reports the switch."""
    code = unused_code()
    vendor = make_vendor(code=code, enabled=False)
    info = signed_in(vendor).get(REFERRAL_URL).json()
    assert (info["referral_code"], info["share_link"], info["enabled"]) == (
        code,
        share_link(vendor, code),
        False,
    )


# --- the public preview ------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def preview_vendors(
    make_vendor: Callable[..., SeededAccount], unused_code: Callable[[], str]
) -> dict[str, tuple[SeededAccount, str]]:
    """Vendors whose codes should (`live`) and should not (`disabled`, `pending`) discount a booking."""
    named_codes = {name: unused_code() for name in ("live", "disabled", "pending")}
    return {
        "live": (make_vendor(code=named_codes["live"]), named_codes["live"]),
        "disabled": (
            make_vendor(code=named_codes["disabled"], enabled=False),
            named_codes["disabled"],
        ),
        "pending": (
            make_vendor(code=named_codes["pending"], approval_status="pending"),
            named_codes["pending"],
        ),
    }


def expected_preview(
    *,
    valid: bool,
    code_valid: bool,
    discount: float,
    tier_min: float | None,
    fee_before: float,
    fee: float,
) -> dict[str, Any]:
    """The full preview body for the given figures."""
    return {
        "success": True,
        "valid": valid,
        "code_valid": code_valid,
        "tiers": FEE_TIERS,
        "service_fee_percent": 5.0,
        "qualified_discount_gbp": discount,
        "tier_min_spend_gbp": tier_min,
        "service_fee_before_discount_gbp": fee_before,
        "service_fee_gbp": fee,
    }


@pytest.mark.parametrize(
    ("portion", "discount", "tier_min", "fee_before", "fee"),
    [
        (500, 10.0, 400.0, 25.0, 15.0),
        (400, 10.0, 400.0, 20.0, 10.0),
        (599.99, 10.0, 400.0, 30.0, 20.0),
        (700, 15.0, 600.0, 35.0, 20.0),
        (12345.67, 15.0, 600.0, 617.28, 602.28),
    ],
)
def test_preview_applies_the_best_tier(
    anonymous: httpx.Client,
    preview_vendors: dict[str, tuple[SeededAccount, str]],
    portion: float,
    discount: float,
    tier_min: float,
    fee_before: float,
    fee: float,
) -> None:
    """The fee is 5% of the vendor's portion, less the tier's discount."""
    vendor, code = preview_vendors["live"]
    response = anonymous.get(
        preview_url(vendor.user_id),
        params={"code": code, "vendor_portion_gbp": portion},
    )
    assert response.status_code == 200
    assert response.json() == expected_preview(
        valid=True,
        code_valid=True,
        discount=discount,
        tier_min=tier_min,
        fee_before=fee_before,
        fee=fee,
    )


def test_preview_below_the_first_tier(
    anonymous: httpx.Client, preview_vendors: dict[str, tuple[SeededAccount, str]]
) -> None:
    """A good code under £400 is recognised but saves nothing."""
    vendor, code = preview_vendors["live"]
    body = anonymous.get(
        preview_url(vendor.user_id), params={"code": code, "vendor_portion_gbp": 399.99}
    ).json()
    assert body == expected_preview(
        valid=False,
        code_valid=True,
        discount=0.0,
        tier_min=None,
        fee_before=20.0,
        fee=20.0,
    )


def test_preview_accepts_a_formatted_code(
    anonymous: httpx.Client, preview_vendors: dict[str, tuple[SeededAccount, str]]
) -> None:
    """Hyphens and spaces in the typed code are ignored."""
    vendor, code = preview_vendors["live"]
    body = anonymous.get(
        preview_url(vendor.user_id),
        params={"code": f" {dashed(code)} ", "vendor_portion_gbp": 500},
    ).json()
    assert (body["valid"], body["code_valid"], body["service_fee_gbp"]) == (
        True,
        True,
        15.0,
    )


def test_preview_without_a_code(
    anonymous: httpx.Client, preview_vendors: dict[str, tuple[SeededAccount, str]]
) -> None:
    """No code: the full fee; the portion defaults to zero."""
    vendor, _code = preview_vendors["live"]
    with_portion = anonymous.get(preview_url(vendor.user_id), params={"vendor_portion_gbp": 500}).json()
    assert with_portion == expected_preview(
        valid=False,
        code_valid=False,
        discount=0.0,
        tier_min=None,
        fee_before=25.0,
        fee=25.0,
    )
    nothing = anonymous.get(preview_url(vendor.user_id)).json()
    assert nothing == expected_preview(
        valid=False,
        code_valid=False,
        discount=0.0,
        tier_min=None,
        fee_before=0.0,
        fee=0.0,
    )


@pytest.mark.parametrize(
    "case",
    ["another vendor", "disabled", "pending", "unknown", "letters", "not a uuid"],
)
def test_preview_rejects_codes_that_do_not_apply(
    anonymous: httpx.Client,
    preview_vendors: dict[str, tuple[SeededAccount, str]],
    unused_code: Callable[[], str],
    case: str,
) -> None:
    """Someone else's, switched-off, unapproved, unknown or non-numeric codes give the full fee."""
    live_vendor, live_code = preview_vendors["live"]
    vendor_id_and_code = {
        "another vendor": (preview_vendors["disabled"][0].user_id, live_code),
        "disabled": (
            preview_vendors["disabled"][0].user_id,
            preview_vendors["disabled"][1],
        ),
        "pending": (
            preview_vendors["pending"][0].user_id,
            preview_vendors["pending"][1],
        ),
        "unknown": (live_vendor.user_id, unused_code()),
        "letters": (live_vendor.user_id, "abc"),
        "not a uuid": ("not-a-vendor", live_code),
    }
    vendor_user_id, code = vendor_id_and_code[case]
    response = anonymous.get(preview_url(vendor_user_id), params={"code": code, "vendor_portion_gbp": 500})
    assert response.status_code == 200
    assert response.json() == expected_preview(
        valid=False,
        code_valid=False,
        discount=0.0,
        tier_min=None,
        fee_before=25.0,
        fee=25.0,
    )


@pytest.mark.parametrize("portion", ["-1", "10000000.01", "lots"])
def test_preview_portion_bounds(anonymous: httpx.Client, portion: str) -> None:
    """The portion must be a number from 0 to £10m."""
    response = anonymous.get(preview_url(str(uuid.uuid4())), params={"vendor_portion_gbp": portion})
    assert response.status_code == 422


# --- bookings that used a code ----------------------------------------------------------------------


@pytest.fixture(scope="module")
def referral_bookings(
    admin_db: LocalDatabase,
    make_vendor: Callable[..., SeededAccount],
    unused_code: Callable[[], str],
) -> Iterator[dict[str, Any]]:
    """One vendor's bookings covering each discount rule, booked by three differently named clients.

    Yields the vendor, their code, and the booking ids by letter (A is the most
    recently updated). Clients are deleted afterwards; bookings go with the vendors.
    """
    own_code = unused_code()
    rival_code = unused_code()
    retired_code = unused_code()
    vendor = make_vendor(code=own_code)
    rival = make_vendor(code=rival_code)

    email_suffix = uuid.uuid4().hex[:8]
    named_client = seed_account(admin_db, unique_email("ref-named"), "client")
    admin_db.table("users").update({"preferred_name": "  Priya Patel  "}).eq(
        "id", named_client.user_id
    ).execute()
    email_client = seed_account(admin_db, f"jane.doe_x{email_suffix}@example.com", "client")
    deleted_client = seed_account(admin_db, unique_email("ref-deleted"), "client")
    close_account(admin_db, deleted_client.user_id)

    def booking(
        letter: str,
        day: int,
        *,
        client: SeededAccount,
        code: str | None,
        prices: list[float | None],
        adjustments: list[dict[str, Any]] | None = None,
        payment_status: str = "unpaid",
        stored_discount: float | None = None,
        status: str = "pending",
        owner: SeededAccount = vendor,
    ) -> dict[str, Any]:
        """One booking row; `day` sets both the event date and the timestamps (higher is newer)."""
        return {
            "client_user_id": client.user_id,
            "vendor_user_id": owner.user_id,
            "event_name": f"Referral booking {letter}",
            "event_date": f"2099-03-{day:02d}",
            "total_label": "GBP 0",
            "status": status,
            "payment_status": payment_status,
            "vendor_referral_code": code,
            "referral_fee_discount_gbp": stored_discount,
            "line_items": [
                {"name": f"Item {index}", "unit_price_gbp": price} for index, price in enumerate(prices)
            ],
            "vendor_adjustments": adjustments or [],
            "created_at": f"2030-01-{day:02d}T09:00:00+00:00",
            "updated_at": f"2030-01-{day:02d}T12:00:00+00:00",
        }

    rows = [
        booking("A", 20, client=named_client, code=own_code, prices=[500]),
        booking(
            "B",
            19,
            client=email_client,
            code=own_code,
            prices=[700],
            payment_status="paid",
            stored_discount=12.34,
            status="completed",
        ),
        booking("C", 18, client=deleted_client, code=rival_code, prices=[700]),
        booking(
            "D",
            17,
            client=named_client,
            code=own_code,
            prices=[300],
            adjustments=[{"id": "adjustment-0001", "label": "Travel", "amount_gbp": 150}],
        ),
        booking("E", 16, client=named_client, code=None, prices=[900]),
        booking("F", 15, client=email_client, code=own_code, prices=[None, 500]),
        booking(
            "G",
            14,
            client=email_client,
            code=retired_code,
            prices=[450],
            status="declined",
        ),
        booking(
            "H",
            13,
            client=named_client,
            code=own_code,
            prices=[650],
            payment_status="payout_released",
            status="completed",
        ),
        booking("I", 12, client=named_client, code=own_code, prices=[100]),
        booking("J", 11, client=named_client, code=rival_code, prices=[900], owner=rival),
    ]
    inserted = admin_db.table("booking_requests").insert(rows).execute().data
    booking_ids = {row["event_name"].removeprefix("Referral booking "): str(row["id"]) for row in inserted}
    yield {
        "vendor": vendor,
        "code": own_code,
        "rival_code": rival_code,
        "retired_code": retired_code,
        "booking_ids": booking_ids,
        "email_suffix": email_suffix,
    }
    for client in (named_client, email_client, deleted_client):
        admin_db.table("booking_requests").delete().eq("client_user_id", client.user_id).execute()
        admin_db.auth.admin.delete_user(client.user_id)


def test_referral_bookings_list_and_savings(
    signed_in: Callable[[SeededAccount], httpx.Client],
    referral_bookings: dict[str, Any],
) -> None:
    """Bookings with any code, newest first; paid bookings keep their stored discount."""
    response = signed_in(referral_bookings["vendor"]).get(BOOKINGS_URL)
    assert response.status_code == 200
    body = response.json()
    booking_ids: dict[str, str] = referral_bookings["booking_ids"]
    own_code = referral_bookings["code"]
    expected_rows = [
        # letter, status, payment, portion, discount, code, client name
        ("A", "pending", "unpaid", 500.0, 10.0, own_code, "Priya Patel"),
        (
            "B",
            "completed",
            "paid",
            700.0,
            12.34,
            own_code,
            f"Jane Doe X{referral_bookings['email_suffix']}",
        ),
        (
            "C",
            "pending",
            "unpaid",
            700.0,
            0.0,
            referral_bookings["rival_code"],
            "Deleted user",
        ),
        ("D", "pending", "unpaid", 450.0, 10.0, own_code, "Priya Patel"),
        (
            "F",
            "pending",
            "unpaid",
            500.0,
            10.0,
            own_code,
            f"Jane Doe X{referral_bookings['email_suffix']}",
        ),
        (
            "G",
            "declined",
            "unpaid",
            450.0,
            10.0,
            referral_bookings["retired_code"],
            f"Jane Doe X{referral_bookings['email_suffix']}",
        ),
        ("H", "completed", "payout_released", 650.0, 15.0, own_code, "Priya Patel"),
        ("I", "pending", "unpaid", 100.0, 0.0, own_code, "Priya Patel"),
    ]
    assert body["success"] is True
    assert body["total_referral_bookings"] == len(expected_rows)
    assert body["total_fee_savings_gbp"] == 67.34
    assert [row["booking_request_id"] for row in body["bookings"]] == [
        booking_ids[row[0]] for row in expected_rows
    ]
    for returned, (
        letter,
        status,
        payment,
        portion,
        discount,
        code,
        client_name,
    ) in zip(body["bookings"], expected_rows, strict=True):
        assert returned == {
            "booking_request_id": booking_ids[letter],
            "event_name": f"Referral booking {letter}",
            "event_date": returned["event_date"],
            "booking_status": status,
            "payment_status": payment,
            "vendor_portion_gbp": portion,
            "referral_fee_discount_gbp": discount,
            "referral_code": code,
            "client_display_name": client_name,
            "created_at": returned["created_at"],
        }, letter
        assert returned["event_date"].startswith("2099-03-")
        assert len(returned["event_date"]) == 10
        assert returned["created_at"].startswith("2030-01-")
