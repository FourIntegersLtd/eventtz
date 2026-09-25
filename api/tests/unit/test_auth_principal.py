"""`principal_from` reproduces the baseline's user_type / admin_role / status rules."""

from __future__ import annotations

from app.core.auth import principal_from

# The configured super-admin fallback list used by most cases.
SUPERS = ["boss@example.com"]


def test_defaults_to_verified_client_without_profile() -> None:
    principal = principal_from({"id": "u1", "email": "a@example.com"}, None, SUPERS)
    assert (
        principal.user_type,
        principal.admin_role,
        principal.email_verified,
        principal.account_suspended,
        principal.deleted,
    ) == (
        "client",
        None,
        True,
        False,
        False,
    )


def test_app_metadata_beats_user_metadata() -> None:
    user = {"id": "u1", "app_metadata": {"user_type": "vendor"}, "user_metadata": {"user_type": "client"}}
    assert principal_from(user, None, SUPERS).user_type == "vendor"


def test_user_metadata_used_when_app_metadata_missing() -> None:
    user = {"id": "u1", "user_metadata": {"user_type": "vendor"}}
    assert principal_from(user, None, SUPERS).user_type == "vendor"


def test_db_admin_wins_over_metadata() -> None:
    user = {"id": "u1", "email": "x@example.com", "user_metadata": {"user_type": "client"}}
    principal = principal_from(user, {"user_type": "admin"}, SUPERS)
    assert (principal.user_type, principal.admin_role, principal.email_verified) == ("admin", "admin", True)


def test_db_admin_role_is_used() -> None:
    principal = principal_from({"id": "u1"}, {"user_type": "admin", "admin_role": "super_admin"}, [])
    assert principal.admin_role == "super_admin"
    assert principal.is_super_admin


def test_super_admin_email_list_is_fallback() -> None:
    principal = principal_from({"id": "u1", "email": "Boss@Example.com"}, {"user_type": "admin"}, SUPERS)
    assert principal.admin_role == "super_admin"


def test_unverified_client_profile() -> None:
    principal = principal_from({"id": "u1"}, {"user_type": "client", "email_verified_at": None}, SUPERS)
    assert principal.email_verified is False


def test_suspended_and_deleted_flags() -> None:
    profile = {"account_suspended": True, "deleted_at": "2026-01-01T00:00:00Z", "email_verified_at": "x"}
    principal = principal_from({"id": "u1"}, profile, SUPERS)
    assert (principal.account_suspended, principal.deleted, principal.email_verified) == (True, True, True)
