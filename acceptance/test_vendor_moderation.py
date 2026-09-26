"""Freeze: admin vendor moderation - listing, approval, unsubmit, listing media/override, nudges.

Owned by the `admin` and `vendors` slices, mounted at `/api/v1/admin/vendors`. Skips
`/insights` and `/restore-stripe-connect` (out of scope). Every mutating test seeds a
fresh vendor account with `seed_account` and plants its `vendors` row directly through
`admin_db`, so runs stay independent of each other and of the onboarding-validation
rules covered in `test_vendor_profile.py`.
"""

from __future__ import annotations

import uuid

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
LISTING_OVERRIDE_SUPER_ADMIN_ONLY = "Only super admins can force a vendor listing visible or hidden."
# The admin slice's own copy of this message has no trailing period, unlike the vendors
# slice's `vendor_messages.VENDOR_PROFILE_NOT_FOUND` used inside the nudge functions below.
VENDOR_PROFILE_NOT_FOUND_HTTP = "Vendor profile not found"
VENDOR_PROFILE_NOT_FOUND_NUDGE = "Vendor profile not found."
NO_EMAIL_ON_FILE = "No email address on file."
ONLY_SUBMITTED_PROFILES_TO_DRAFT = "Only submitted profiles can be returned to draft."
ONLY_PENDING_VENDORS_TO_DRAFT = "Only pending vendors can be returned to draft."
LISTING_MEDIA_URL_INVALID = "Listing media overrides must use the vendor profile photo or portfolio images."
LISTING_OVERRIDE_REASON_REQUIRED = "Give a reason when overriding a vendor's listing."

VENDORS_URL = f"{API}/admin/vendors"
S3_HOST = "eventtz.s3.eu-west-2.amazonaws.com"

# A UUID no vendor will ever have, for 404 checks.
MISSING_USER_ID = "00000000-0000-4000-8000-000000000000"


def _s3_url(user_id: str, name: str) -> str:
    """A URL that `allowed_listing_media_urls` accepts as this vendor's own upload."""
    return f"https://{S3_HOST}/users/{user_id}/{name}"


def _seed_vendor(
    admin_db: Client,
    label: str,
    *,
    status: str = "draft",
    approval_status: str = "pending",
    payload: dict[str, object] | None = None,
) -> str:
    """A fresh vendor account with a `vendors` row inserted directly. Returns the user id."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": status,
            "approval_status": approval_status,
            "payload": payload or {},
        }
    ).execute()
    return account.user_id


def _latest_audit_row(admin_db: Client, *, action: str, entity_id: str | None) -> dict[str, object]:
    """The newest `admin_audit_log` row for this action/entity, asserting one exists.

    `entity_id=None` matches broadcast-style actions (the profile/payout nudges), which
    are logged with `entity_id=None` because they act on a list of vendors, not one.
    """
    query = admin_db.table("admin_audit_log").select("*").eq("action", action)
    query = query.is_("entity_id", "null") if entity_id is None else query.eq("entity_id", entity_id)
    rows = query.order("created_at", desc=True).limit(1).execute().data
    assert rows, f"expected an admin_audit_log row for action={action} entity_id={entity_id}"
    return rows[0]


def test_admin_list_vendors_without_a_session_is_401() -> None:
    """GET /admin/vendors requires sign-in."""
    with new_browser() as browser:
        response = browser.get(VENDORS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_admin_list_vendors_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot list vendors: the admin portal message, not the vendor one."""
    account = seed_account(admin_db, unique_email("mod-list-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(VENDORS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_list_vendors_filters_by_approval_status(admin_db: Client, as_staff) -> None:
    """`approval_status` narrows the list to vendors in exactly that state."""
    label = uuid.uuid4().hex[:8]
    approved_id = _seed_vendor(admin_db, f"mod-list-appr-{label}-a", approval_status="approved")
    _seed_vendor(admin_db, f"mod-list-appr-{label}-b", approval_status="pending")

    response = as_staff.get(VENDORS_URL, params={"approval_status": "approved", "q": label})
    assert response.status_code == 200
    body = response.json()
    ids = {row["user_id"] for row in body["vendors"]}
    assert ids == {approved_id}
    assert body["total"] == 1


def test_admin_list_vendors_filters_by_status(admin_db: Client, as_staff) -> None:
    """`status` narrows the list to vendors with that onboarding status."""
    label = uuid.uuid4().hex[:8]
    submitted_id = _seed_vendor(admin_db, f"mod-list-status-{label}-a", status="submitted")
    _seed_vendor(admin_db, f"mod-list-status-{label}-b", status="draft")

    response = as_staff.get(VENDORS_URL, params={"status": "submitted", "q": label})
    assert response.status_code == 200
    body = response.json()
    ids = {row["user_id"] for row in body["vendors"]}
    assert ids == {submitted_id}


def test_admin_list_vendors_filters_by_q_matching_email(admin_db: Client, as_staff) -> None:
    """`q` matches by vendor email (case-insensitive substring)."""
    label = uuid.uuid4().hex[:8]
    matching_id = _seed_vendor(admin_db, f"mod-list-q-{label}")
    _seed_vendor(admin_db, f"mod-list-other-{uuid.uuid4().hex[:8]}")

    response = as_staff.get(VENDORS_URL, params={"q": f"mod-list-q-{label}"})
    assert response.status_code == 200
    body = response.json()
    ids = {row["user_id"] for row in body["vendors"]}
    assert ids == {matching_id}
    assert body["total"] == 1


def test_admin_list_vendors_pagination_totals(admin_db: Client, as_staff) -> None:
    """`total` reflects the full filtered count even when `limit` returns fewer rows."""
    label = uuid.uuid4().hex[:8]
    for index in range(3):
        _seed_vendor(admin_db, f"mod-list-page-{label}-{index}")

    first_page = as_staff.get(VENDORS_URL, params={"q": f"mod-list-page-{label}", "limit": 2, "offset": 0})
    assert first_page.status_code == 200
    first_body = first_page.json()
    assert first_body["total"] == 3
    assert len(first_body["vendors"]) == 2
    assert first_body["offset"] == 0
    assert first_body["limit"] == 2

    second_page = as_staff.get(VENDORS_URL, params={"q": f"mod-list-page-{label}", "limit": 2, "offset": 2})
    second_body = second_page.json()
    assert second_body["total"] == 3
    assert len(second_body["vendors"]) == 1


def test_admin_approval_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot change any vendor's approval status."""
    account = seed_account(admin_db, unique_email("mod-approve-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.patch(
        f"{VENDORS_URL}/{MISSING_USER_ID}/approval", json={"approval_status": "approved"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_approval_missing_vendor_profile_is_404(as_staff) -> None:
    """Approving a user id with no `vendors` row is a 404, not a silent no-op."""
    response = as_staff.patch(
        f"{VENDORS_URL}/{MISSING_USER_ID}/approval", json={"approval_status": "approved"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == VENDOR_PROFILE_NOT_FOUND_HTTP


def test_admin_approval_invalid_value_is_a_pydantic_validation_error(as_staff) -> None:
    """An approval_status outside pending/approved/banned is rejected by the request model."""
    response = as_staff.patch(f"{VENDORS_URL}/{MISSING_USER_ID}/approval", json={"approval_status": "bogus"})
    assert response.status_code == 422


def test_admin_approval_transition_writes_status_and_audit_log(admin_db: Client, as_staff) -> None:
    """Approving a vendor persists `approval_status` and writes an audit log row."""
    user_id = _seed_vendor(admin_db, "mod-approve-ok", approval_status="pending")
    response = as_staff.patch(f"{VENDORS_URL}/{user_id}/approval", json={"approval_status": "approved"})
    assert response.status_code == 200
    body = response.json()
    assert body == {"success": True, "user_id": user_id, "approval_status": "approved"}

    row = admin_db.table("vendors").select("approval_status").eq("user_id", user_id).execute().data[0]
    assert row["approval_status"] == "approved"

    audit_row = _latest_audit_row(admin_db, action="vendor.approval", entity_id=user_id)
    assert audit_row["payload"]["approval_status"] == "approved"


def test_admin_unsubmit_requires_a_submitted_profile(admin_db: Client, as_staff) -> None:
    """A draft (never-submitted) vendor cannot be unsubmitted."""
    user_id = _seed_vendor(admin_db, "mod-unsubmit-draft", status="draft")
    response = as_staff.patch(f"{VENDORS_URL}/{user_id}/unsubmit", json={"send_email": False})
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_SUBMITTED_PROFILES_TO_DRAFT


def test_admin_unsubmit_requires_pending_approval(admin_db: Client, as_staff) -> None:
    """A submitted-but-already-approved vendor cannot be unsubmitted (approval must be pending)."""
    user_id = _seed_vendor(admin_db, "mod-unsubmit-approved", status="submitted", approval_status="approved")
    response = as_staff.patch(f"{VENDORS_URL}/{user_id}/unsubmit", json={"send_email": False})
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PENDING_VENDORS_TO_DRAFT


def test_admin_unsubmit_missing_vendor_profile_is_404(as_staff) -> None:
    """Unsubmitting a user id with no `vendors` row is a 404."""
    response = as_staff.patch(f"{VENDORS_URL}/{MISSING_USER_ID}/unsubmit", json={"send_email": False})
    assert response.status_code == 404
    assert response.json()["detail"] == VENDOR_PROFILE_NOT_FOUND_HTTP


def test_admin_unsubmit_happy_path_returns_to_draft(admin_db: Client, as_staff) -> None:
    """A submitted, pending vendor is returned to draft; `email_sent` reports the send result.

    Resend is disabled in this environment (`RESEND_API_KEY=""`), so the underlying send
    always reports failure and `email_sent` is always false here - a baseline quirk of the
    test environment, not of the route's shape.
    """
    user_id = _seed_vendor(
        admin_db,
        "mod-unsubmit-ok",
        status="submitted",
        approval_status="pending",
        payload={"businessName": f"Unsubmit Me {uuid.uuid4().hex[:8]}"},
    )
    response = as_staff.patch(f"{VENDORS_URL}/{user_id}/unsubmit", json={"send_email": True})
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == user_id
    assert body["status"] == "draft"
    assert body["email_sent"] is False

    row = admin_db.table("vendors").select("status,current_step").eq("user_id", user_id).execute().data[0]
    assert row["status"] == "draft"
    assert row["current_step"] == 8

    audit_row = _latest_audit_row(admin_db, action="vendor.unsubmit", entity_id=user_id)
    assert audit_row["payload"]["status"] == "draft"
    assert audit_row["payload"]["email_sent"] is False


def test_admin_listing_media_rejects_a_url_not_in_the_vendors_payload(admin_db: Client, as_staff) -> None:
    """Listing-media overrides may only reorder/hide URLs already in the vendor's own payload."""
    user_id = _seed_vendor(
        admin_db,
        "mod-media-invalid",
        payload={"profileImageUrl": _s3_url("someone-else", "profile.jpg")},
    )
    response = as_staff.patch(
        f"{VENDORS_URL}/{user_id}/listing-media",
        json={"display_order": ["https://evil.example.com/x.jpg"], "hidden_image_urls": []},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == LISTING_MEDIA_URL_INVALID


def test_admin_listing_media_sets_display_order_and_hidden_state(admin_db: Client, as_staff) -> None:
    """A valid override persists the display order and hidden set, and returns the resolved cover."""
    user_id = _seed_vendor(admin_db, "mod-media-valid")
    profile_url = _s3_url(user_id, "profile.jpg")
    portfolio_a = _s3_url(user_id, "a.jpg")
    portfolio_b = _s3_url(user_id, "b.jpg")
    admin_db.table("vendors").update(
        {"payload": {"profileImageUrl": profile_url, "portfolioFileNames": [portfolio_a, portfolio_b]}}
    ).eq("user_id", user_id).execute()

    response = as_staff.patch(
        f"{VENDORS_URL}/{user_id}/listing-media",
        json={"display_order": [portfolio_b, portfolio_a, profile_url], "hidden_image_urls": []},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["display_order"] == [portfolio_b, portfolio_a, profile_url]
    assert body["hidden_image_urls"] == []
    assert body["listing_cover_image_url"] == portfolio_b

    audit_row = _latest_audit_row(admin_db, action="vendor.listing_media_set", entity_id=user_id)
    assert audit_row["payload"]["listing_cover_image_url"] == portfolio_b
    assert audit_row["payload"]["display_order_count"] == 3


def test_admin_listing_override_visible_or_hidden_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin (support role) cannot force a listing visible or hidden."""
    user_id = _seed_vendor(admin_db, "mod-override-plain", approval_status="approved")
    response = as_staff.patch(
        f"{VENDORS_URL}/{user_id}/listing-override",
        json={"listing_override": "hidden", "reason": "test"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == LISTING_OVERRIDE_SUPER_ADMIN_ONLY


def test_admin_listing_override_auto_is_allowed_for_a_plain_admin(admin_db: Client, as_staff) -> None:
    """Reverting a vendor's listing to automatic is allowed for any admin, no reason needed."""
    user_id = _seed_vendor(admin_db, "mod-override-auto", approval_status="approved")
    response = as_staff.patch(
        f"{VENDORS_URL}/{user_id}/listing-override",
        json={"listing_override": "auto"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["listing_override"] == "auto"
    assert body["listing_visible"] is False


def test_admin_listing_override_visible_requires_a_reason(admin_db: Client, as_super_admin) -> None:
    """Even a super admin must give a reason for anything other than `auto`."""
    user_id = _seed_vendor(admin_db, "mod-override-noreason", approval_status="approved")
    response = as_super_admin.patch(
        f"{VENDORS_URL}/{user_id}/listing-override",
        json={"listing_override": "visible"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == LISTING_OVERRIDE_REASON_REQUIRED


def test_admin_listing_override_visible_by_super_admin_waives_the_payout_gate(
    admin_db: Client, as_super_admin
) -> None:
    """A super admin can force an approved vendor visible without verified Stripe payouts."""
    user_id = _seed_vendor(admin_db, "mod-override-visible", approval_status="approved")
    response = as_super_admin.patch(
        f"{VENDORS_URL}/{user_id}/listing-override",
        json={"listing_override": "visible", "reason": "vetted manually"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["listing_override"] == "visible"
    assert body["listing_visible"] is True

    audit_row = _latest_audit_row(admin_db, action="vendor.listing_override", entity_id=user_id)
    assert audit_row["payload"]["listing_override"] == "visible"
    assert audit_row["payload"]["listing_visible"] is True


def test_admin_nudge_profile_complete_shapes_sent_skipped_and_failures(admin_db: Client, as_staff) -> None:
    """Nudging draft vendors reports one shape per outcome: unknown id, draft, non-draft.

    Resend is disabled in this environment, so every real send fails - an eligible draft
    vendor with a real email still lands in `failures` with "No email address on file.",
    because the baseline's email helpers cannot tell a disabled mailer from a missing
    address. This is frozen as a quirk of the test environment.
    """
    draft_id = _seed_vendor(admin_db, "mod-nudge-draft", status="draft")
    submitted_id = _seed_vendor(admin_db, "mod-nudge-submitted", status="submitted")

    response = as_staff.post(
        f"{VENDORS_URL}/nudge-profile-complete",
        json={"user_ids": [draft_id, submitted_id, MISSING_USER_ID]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sent"] == 0
    assert body["skipped"] == 1
    failures_by_id = {failure["user_id"]: failure["error"] for failure in body["failures"]}
    assert failures_by_id[draft_id] == NO_EMAIL_ON_FILE
    assert failures_by_id[MISSING_USER_ID] == VENDOR_PROFILE_NOT_FOUND_NUDGE

    audit_row = _latest_audit_row(admin_db, action="vendor.profile_nudge", entity_id=None)
    assert audit_row["payload"]["skipped"] == 1


def test_admin_nudge_setup_payouts_shapes_sent_skipped_and_failures(admin_db: Client, as_staff) -> None:
    """Nudging for payout setup only targets approved vendors without verified payouts."""
    approved_unpaid_id = _seed_vendor(admin_db, "mod-nudge-payout-approved", approval_status="approved")
    not_approved_id = _seed_vendor(admin_db, "mod-nudge-payout-pending", approval_status="pending")

    response = as_staff.post(
        f"{VENDORS_URL}/nudge-setup-payouts",
        json={"user_ids": [approved_unpaid_id, not_approved_id]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sent"] == 0
    assert body["skipped"] == 1
    failures_by_id = {failure["user_id"]: failure["error"] for failure in body["failures"]}
    assert failures_by_id[approved_unpaid_id] == NO_EMAIL_ON_FILE
    assert not_approved_id not in failures_by_id
