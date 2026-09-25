"""`principal_from` reproduces the baseline's user_type / admin_role / status rules."""

from __future__ import annotations

from app.core.auth import principal_from

SUPERS = ["boss@example.com"]


def test_defaults_to_verified_client_without_profile() -> None:
    p = principal_from({"id": "u1", "email": "a@example.com"}, None, SUPERS)
    assert (p.user_type, p.admin_role, p.email_verified, p.account_suspended, p.deleted) == (
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
    p = principal_from(user, {"user_type": "admin"}, SUPERS)
    assert (p.user_type, p.admin_role, p.email_verified) == ("admin", "admin", True)


def test_db_admin_role_is_used() -> None:
    p = principal_from({"id": "u1"}, {"user_type": "admin", "admin_role": "super_admin"}, [])
    assert p.admin_role == "super_admin"
    assert p.is_super_admin


def test_super_admin_email_list_is_fallback() -> None:
    p = principal_from({"id": "u1", "email": "Boss@Example.com"}, {"user_type": "admin"}, SUPERS)
    assert p.admin_role == "super_admin"


def test_unverified_client_profile() -> None:
    p = principal_from({"id": "u1"}, {"user_type": "client", "email_verified_at": None}, SUPERS)
    assert p.email_verified is False


def test_suspended_and_deleted_flags() -> None:
    profile = {"account_suspended": True, "deleted_at": "2026-01-01T00:00:00Z", "email_verified_at": "x"}
    p = principal_from({"id": "u1"}, profile, SUPERS)
    assert (p.account_suspended, p.deleted, p.email_verified) == (True, True, True)
