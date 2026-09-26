"""Freeze: the admin console's staff management screens.

Covers `/api/v1/admin/team*`, `/api/v1/admin/clients*`, `/api/v1/admin/audit-log*` and
`/api/v1/admin/email/*` (workstream 7). Every mutating test seeds fresh accounts with
`seed_account`/`unique_email` so runs stay independent of each other and of the shared
local database other agents also use.

The "last super admin" guard rails (`CANNOT_DELETE_LAST_SUPER_ADMIN`,
`CANNOT_DEMOTE_LAST_SUPER_ADMIN`) are not frozen here: the local database accumulates
super admins across every run of this suite (each seeded with a fresh, never-reused
email), so "there is only one super admin left" can never be reliably arranged without
deleting accounts other agents' runs may still be relying on.
"""

from __future__ import annotations

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."
NO_FIELDS_TO_UPDATE = "No fields to update"
INVALID_EMAIL_ADDRESS = "Enter a valid email address."
ADMIN_USER_NOT_FOUND = "Admin user not found."
ADMIN_NOT_FOUND = "Admin not found"
CANNOT_DELETE_SELF = "You cannot delete yourself."
CANNOT_DEMOTE_SELF = "You cannot demote yourself."
CANNOT_SUSPEND_SELF = "You cannot suspend yourself."
ADMIN_CREATED = "Admin account created."
ADMIN_CREATED_PASSWORD_LINK = "Admin account created. We sent a link to set their password."
PROMOTED_TO_ADMIN = "Existing account promoted to admin."
ADMIN_ALREADY_PASSWORD_UPDATED = "This person is already an admin. Password updated."
ADMIN_ACCOUNT_DELETED = "Admin account deleted."
PASSWORD_RESET_LINK_SENT = "Password reset link sent."
SUSPENSION_UPDATE_FAILED = "Could not update suspension (migration or user missing)."
AUDIT_ENTRY_NOT_FOUND = "Audit entry not found"
UNKNOWN_EMAIL_TEMPLATE = "Unknown email template."

MISSING_USER_ID = "00000000-0000-4000-8000-000000000000"

TEAM_URL = f"{API}/admin/team"
INVITE_URL = f"{API}/admin/team/invite"
CLIENTS_URL = f"{API}/admin/clients"
AUDIT_LOG_URL = f"{API}/admin/audit-log"
EMAIL_TEMPLATES_URL = f"{API}/admin/email/templates"
EMAIL_TEST_SEND_URL = f"{API}/admin/email/test-send"


def _team_url(user_id: str) -> str:
    """The `/admin/team/{user_id}` URL for one member."""
    return f"{TEAM_URL}/{user_id}"


def _reset_link_url(user_id: str) -> str:
    """The `/admin/team/{user_id}/send-reset-link` URL for one member."""
    return f"{TEAM_URL}/{user_id}/send-reset-link"


def _clients_suspended_url(user_id: str) -> str:
    """The `/admin/clients/{user_id}/suspended` URL for one client."""
    return f"{CLIENTS_URL}/{user_id}/suspended"


def _seed_plain_admin(admin_db: Client, label: str) -> SeededAccount:
    """A fresh plain-`admin` account with no vendor/client rows, so deleting it hard-deletes it."""
    return seed_account(admin_db, unique_email(label), "admin", admin_role="admin")


# --- GET /admin/team ---------------------------------------------------------------------------


def test_list_team_requires_sign_in(anonymous) -> None:
    response = anonymous.get(TEAM_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_list_team_forbidden_for_client_account(as_client) -> None:
    response = as_client.get(TEAM_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_list_team_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.get(TEAM_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_list_team_ok_for_plain_admin(admin_db: Client, as_staff, staff_account: SeededAccount) -> None:
    """A plain admin may view the team (only mutating it is super-admin-only)."""
    response = as_staff.get(TEAM_URL)
    assert response.status_code == 200
    body = response.json()
    member_ids = {member["user_id"] for member in body["members"]}
    assert staff_account.user_id in member_ids


def test_list_team_ok_for_super_admin(as_super_admin, super_admin_account: SeededAccount) -> None:
    response = as_super_admin.get(TEAM_URL)
    assert response.status_code == 200
    member_ids = {member["user_id"] for member in response.json()["members"]}
    assert super_admin_account.user_id in member_ids


# --- POST /admin/team/invite ---------------------------------------------------------------------


def test_invite_requires_sign_in(anonymous) -> None:
    response = anonymous.post(INVITE_URL, json={"email": unique_email("invite")})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_invite_forbidden_for_plain_admin(as_staff) -> None:
    response = as_staff.post(INVITE_URL, json={"email": unique_email("invite")})
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_invite_invalid_email_is_400(as_super_admin) -> None:
    response = as_super_admin.post(INVITE_URL, json={"email": "not-an-email"})
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_EMAIL_ADDRESS


def test_invite_new_email_with_password_creates_admin(admin_db: Client, as_super_admin) -> None:
    email = unique_email("invite-new")
    response = as_super_admin.post(INVITE_URL, json={"email": email, "password": "Str0ngPassw0rd!"})
    assert response.status_code == 200
    body = response.json()
    assert body["created"] is True
    assert body["invite_link_sent"] is False
    assert body["message"] == ADMIN_CREATED
    assert body["admin_role"] == "admin"
    row = admin_db.table("users").select("user_type,admin_role").eq("id", body["user_id"]).limit(1).execute().data
    assert row[0]["user_type"] == "admin"
    assert row[0]["admin_role"] == "admin"


def test_invite_new_email_without_password_sends_link(as_super_admin) -> None:
    email = unique_email("invite-link")
    response = as_super_admin.post(INVITE_URL, json={"email": email})
    assert response.status_code == 200
    body = response.json()
    assert body["created"] is True
    assert body["invite_link_sent"] is True
    assert body["message"] == ADMIN_CREATED_PASSWORD_LINK


def test_invite_existing_client_is_promoted(admin_db: Client, as_super_admin) -> None:
    account = seed_account(admin_db, unique_email("invite-promote"), "client")
    response = as_super_admin.post(
        INVITE_URL, json={"email": account.email, "password": "Str0ngPassw0rd!"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] is False
    assert body["invite_link_sent"] is False
    assert body["message"] == PROMOTED_TO_ADMIN
    assert body["user_id"] == account.user_id
    row = admin_db.table("users").select("user_type").eq("id", account.user_id).limit(1).execute().data
    assert row[0]["user_type"] == "admin"


def test_invite_existing_admin_with_password_updates_password(admin_db: Client, as_super_admin) -> None:
    account = _seed_plain_admin(admin_db, "invite-existing-admin")
    response = as_super_admin.post(INVITE_URL, json={"email": account.email, "password": "Str0ngPassw0rd!"})
    assert response.status_code == 200
    body = response.json()
    assert body["created"] is False
    assert body["invite_link_sent"] is False
    assert body["message"] == ADMIN_ALREADY_PASSWORD_UPDATED


# --- PATCH /admin/team/{user_id} ------------------------------------------------------------------


def test_patch_team_member_requires_sign_in(anonymous) -> None:
    response = anonymous.patch(_team_url(MISSING_USER_ID), json={"account_suspended": True})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_patch_team_member_forbidden_for_plain_admin(admin_db: Client, as_staff) -> None:
    account = _seed_plain_admin(admin_db, "patch-forbidden")
    response = as_staff.patch(_team_url(account.user_id), json={"account_suspended": True})
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_patch_team_member_empty_body_is_400(as_super_admin, super_admin_account: SeededAccount) -> None:
    response = as_super_admin.patch(_team_url(super_admin_account.user_id), json={})
    assert response.status_code == 400
    assert response.json()["detail"] == NO_FIELDS_TO_UPDATE


def test_patch_team_member_missing_id_is_400(as_super_admin) -> None:
    response = as_super_admin.patch(_team_url(MISSING_USER_ID), json={"account_suspended": True})
    assert response.status_code == 400
    assert response.json()["detail"] == ADMIN_USER_NOT_FOUND


def test_patch_team_member_cannot_demote_self(as_super_admin, super_admin_account: SeededAccount) -> None:
    response = as_super_admin.patch(_team_url(super_admin_account.user_id), json={"admin_role": "admin"})
    assert response.status_code == 400
    assert response.json()["detail"] == CANNOT_DEMOTE_SELF


def test_patch_team_member_cannot_suspend_self(as_super_admin, super_admin_account: SeededAccount) -> None:
    response = as_super_admin.patch(_team_url(super_admin_account.user_id), json={"account_suspended": True})
    assert response.status_code == 400
    assert response.json()["detail"] == CANNOT_SUSPEND_SELF


def test_patch_team_member_promotes_and_suspends(admin_db: Client, as_super_admin) -> None:
    account = _seed_plain_admin(admin_db, "patch-happy")
    promoted = as_super_admin.patch(_team_url(account.user_id), json={"admin_role": "super_admin"})
    assert promoted.status_code == 200
    body = promoted.json()
    assert body["user_id"] == account.user_id
    assert body["admin_role"] == "super_admin"
    assert body["account_suspended"] is False

    suspended = as_super_admin.patch(_team_url(account.user_id), json={"account_suspended": True})
    assert suspended.status_code == 200
    assert suspended.json()["account_suspended"] is True


# --- DELETE /admin/team/{user_id} -----------------------------------------------------------------


def test_delete_team_member_requires_sign_in(anonymous) -> None:
    response = anonymous.delete(_team_url(MISSING_USER_ID))
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_delete_team_member_forbidden_for_plain_admin(admin_db: Client, as_staff) -> None:
    account = _seed_plain_admin(admin_db, "delete-forbidden")
    response = as_staff.delete(_team_url(account.user_id))
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_delete_team_member_cannot_delete_self(as_super_admin, super_admin_account: SeededAccount) -> None:
    response = as_super_admin.delete(_team_url(super_admin_account.user_id))
    assert response.status_code == 400
    assert response.json()["detail"] == CANNOT_DELETE_SELF


def test_delete_team_member_missing_id_is_400(as_super_admin) -> None:
    response = as_super_admin.delete(_team_url(MISSING_USER_ID))
    assert response.status_code == 400
    assert response.json()["detail"] == ADMIN_USER_NOT_FOUND


def test_delete_team_member_hard_deletes_plain_account(admin_db: Client, as_super_admin) -> None:
    account = _seed_plain_admin(admin_db, "delete-happy")
    response = as_super_admin.delete(_team_url(account.user_id))
    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] is True
    assert body["demoted_to"] is None
    assert body["message"] == ADMIN_ACCOUNT_DELETED
    remaining = admin_db.table("users").select("id").eq("id", account.user_id).limit(1).execute().data
    assert remaining == []


# --- POST /admin/team/{user_id}/send-reset-link ---------------------------------------------------


def test_send_reset_link_requires_sign_in(anonymous) -> None:
    response = anonymous.post(_reset_link_url(MISSING_USER_ID))
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_send_reset_link_forbidden_for_plain_admin(admin_db: Client, as_staff) -> None:
    account = _seed_plain_admin(admin_db, "reset-forbidden")
    response = as_staff.post(_reset_link_url(account.user_id))
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_send_reset_link_missing_id_is_400(as_super_admin) -> None:
    response = as_super_admin.post(_reset_link_url(MISSING_USER_ID))
    assert response.status_code == 400
    assert response.json()["detail"] == ADMIN_USER_NOT_FOUND


def test_send_reset_link_happy_path(admin_db: Client, as_super_admin) -> None:
    account = _seed_plain_admin(admin_db, "reset-happy")
    response = as_super_admin.post(_reset_link_url(account.user_id))
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == account.user_id
    assert body["email"] == account.email
    assert body["message"] == PASSWORD_RESET_LINK_SENT


# --- GET /admin/clients, PATCH /admin/clients/{user_id}/suspended -----------------------------------


def test_list_clients_requires_sign_in(anonymous) -> None:
    response = anonymous.get(CLIENTS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_list_clients_forbidden_for_client_account(as_client) -> None:
    response = as_client.get(CLIENTS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_list_clients_ok_for_plain_admin(admin_db: Client, as_staff) -> None:
    account = seed_account(admin_db, unique_email("directory-client"), "client")
    response = as_staff.get(CLIENTS_URL, params={"q": account.email})
    assert response.status_code == 200
    body = response.json()
    assert body["clients"][0]["user_id"] == account.user_id
    assert body["clients"][0]["account_suspended"] is False


def test_patch_client_suspended_requires_sign_in(anonymous) -> None:
    response = anonymous.patch(_clients_suspended_url(MISSING_USER_ID), json={"suspended": True})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_patch_client_suspended_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.patch(_clients_suspended_url(MISSING_USER_ID), json={"suspended": True})
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_patch_client_suspended_ok_for_plain_admin_writes_audit_log(admin_db: Client, as_staff) -> None:
    account = seed_account(admin_db, unique_email("suspend-client"), "client")

    suspend = as_staff.patch(_clients_suspended_url(account.user_id), json={"suspended": True})
    assert suspend.status_code == 200
    assert suspend.json() == {"success": True}
    row = admin_db.table("users").select("account_suspended").eq("id", account.user_id).limit(1).execute().data
    assert row[0]["account_suspended"] is True

    unsuspend = as_staff.patch(_clients_suspended_url(account.user_id), json={"suspended": False})
    assert unsuspend.status_code == 200
    row = admin_db.table("users").select("account_suspended").eq("id", account.user_id).limit(1).execute().data
    assert row[0]["account_suspended"] is False


# --- GET /admin/audit-log, GET /admin/audit-log/{entry_id} ------------------------------------------


def test_audit_log_requires_sign_in(anonymous) -> None:
    response = anonymous.get(AUDIT_LOG_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_audit_log_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.get(AUDIT_LOG_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_audit_log_lists_a_recorded_team_action(admin_db: Client, as_super_admin) -> None:
    account = _seed_plain_admin(admin_db, "audit-team-patch")
    patch = as_super_admin.patch(_team_url(account.user_id), json={"account_suspended": True})
    assert patch.status_code == 200

    listing = as_super_admin.get(AUDIT_LOG_URL, params={"category": "team", "limit": 500})
    assert listing.status_code == 200
    body = listing.json()
    entity_ids = {entry["entity_id"] for entry in body["entries"]}
    assert account.user_id in entity_ids


def test_audit_log_detail_ok_for_plain_admin(admin_db: Client, as_super_admin, as_staff) -> None:
    account = _seed_plain_admin(admin_db, "audit-detail")
    patch = as_super_admin.patch(_team_url(account.user_id), json={"account_suspended": True})
    assert patch.status_code == 200
    listing = as_super_admin.get(AUDIT_LOG_URL, params={"category": "team", "limit": 500})
    entry_id = next(
        entry["id"] for entry in listing.json()["entries"] if entry["entity_id"] == account.user_id
    )

    detail = as_staff.get(f"{AUDIT_LOG_URL}/{entry_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["entry"]["id"] == entry_id
    assert body["entry"]["action"] == "admin.team_patch"
    assert body["entry"]["entity_id"] == account.user_id


def test_audit_log_detail_missing_id_is_404(as_staff) -> None:
    response = as_staff.get(f"{AUDIT_LOG_URL}/{MISSING_USER_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == AUDIT_ENTRY_NOT_FOUND


# --- GET /admin/email/templates, POST /admin/email/test-send ----------------------------------------


def test_email_templates_requires_sign_in(anonymous) -> None:
    response = anonymous.get(EMAIL_TEMPLATES_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_email_templates_forbidden_for_plain_admin(as_staff) -> None:
    response = as_staff.get(EMAIL_TEMPLATES_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_email_templates_lists_the_fixed_set(as_super_admin) -> None:
    response = as_super_admin.get(EMAIL_TEMPLATES_URL)
    assert response.status_code == 200
    template_ids = {template["id"] for template in response.json()["templates"]}
    assert template_ids == {"health", "layout.welcome", "layout.auth", "layout.admin"}


def test_email_test_send_requires_sign_in(anonymous) -> None:
    response = anonymous.post(
        EMAIL_TEST_SEND_URL, json={"template_id": "health", "to_email": unique_email("email-test")}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_email_test_send_forbidden_for_plain_admin(as_staff) -> None:
    response = as_staff.post(
        EMAIL_TEST_SEND_URL, json={"template_id": "health", "to_email": unique_email("email-test")}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_email_test_send_unknown_template_is_400(as_super_admin) -> None:
    response = as_super_admin.post(
        EMAIL_TEST_SEND_URL, json={"template_id": "not-a-template", "to_email": unique_email("email-test")}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == UNKNOWN_EMAIL_TEMPLATE


def test_email_test_send_invalid_email_is_400(as_super_admin) -> None:
    response = as_super_admin.post(
        EMAIL_TEST_SEND_URL, json={"template_id": "health", "to_email": "not-an-email"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_EMAIL_ADDRESS


def test_email_test_send_writes_audit_log(admin_db: Client, as_super_admin) -> None:
    to_email = unique_email("email-test-send")
    response = as_super_admin.post(EMAIL_TEST_SEND_URL, json={"template_id": "health", "to_email": to_email})
    assert response.status_code == 200
    body = response.json()
    assert body["delivered"] in (True, False)
    assert body["success"] == body["delivered"]

    listing = as_super_admin.get(AUDIT_LOG_URL, params={"category": "all", "limit": 500})
    assert listing.status_code == 200
    matches = [
        entry
        for entry in listing.json()["entries"]
        if entry["action"] == "email.test_send" and entry["audit_event_details"]["to_email"] == to_email
    ]
    assert len(matches) == 1
