"""`principal_from` reproduces the baseline's user_type / admin_role / status rules from a `users` row."""

from __future__ import annotations

from app.core.auth import AccountRecord, principal_from

# The configured super-admin fallback list used by most cases.
SUPER_ADMIN_EMAILS = ["boss@example.com"]


def account(**overrides: object) -> AccountRecord:
    """A verified client's `users` row, with `overrides` applied."""
    columns: dict[str, object] = {
        "id": "user-1",
        "email": "ada@example.com",
        "user_type": "client",
        "admin_role": None,
        "account_suspended": False,
        "email_verified": True,
        "deleted": False,
    }
    columns.update(overrides)
    return AccountRecord(**columns)  # type: ignore[arg-type]


def test_a_client_row_becomes_a_client_principal() -> None:
    principal = principal_from(account(), SUPER_ADMIN_EMAILS)
    assert (principal.id, principal.email, principal.user_type, principal.admin_role) == (
        "user-1",
        "ada@example.com",
        "client",
        None,
    )


def test_an_unknown_or_missing_user_type_counts_as_a_client() -> None:
    assert principal_from(account(user_type="wizard"), SUPER_ADMIN_EMAILS).user_type == "client"
    assert principal_from(account(user_type=None), SUPER_ADMIN_EMAILS).user_type == "client"


def test_vendors_keep_their_type() -> None:
    assert principal_from(account(user_type="vendor"), SUPER_ADMIN_EMAILS).user_type == "vendor"


def test_a_stored_admin_role_is_used() -> None:
    principal = principal_from(account(user_type="admin", admin_role="super_admin"), [])
    assert principal.admin_role == "super_admin"
    assert principal.is_super_admin


def test_the_super_admin_email_list_is_the_fallback_whatever_the_case() -> None:
    principal = principal_from(account(user_type="admin", email="Boss@Example.com"), SUPER_ADMIN_EMAILS)
    assert principal.admin_role == "super_admin"


def test_staff_without_a_role_or_listed_email_are_plain_admins() -> None:
    principal = principal_from(account(user_type="admin"), SUPER_ADMIN_EMAILS)
    assert (principal.admin_role, principal.is_super_admin) == ("admin", False)


def test_staff_always_count_as_verified_and_others_keep_their_state() -> None:
    assert principal_from(account(user_type="admin", email_verified=False), []).email_verified is True
    assert principal_from(account(email_verified=False), []).email_verified is False


def test_a_role_on_a_non_staff_row_is_ignored() -> None:
    assert principal_from(account(admin_role="super_admin"), []).admin_role is None


def test_suspended_and_deleted_flags_carry_over() -> None:
    principal = principal_from(account(account_suspended=True, deleted=True), SUPER_ADMIN_EMAILS)
    assert (principal.account_suspended, principal.deleted) == (True, True)
