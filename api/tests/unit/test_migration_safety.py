"""`app.migration.safety`: the local-only check every command runs before it opens a connection."""

from __future__ import annotations

import pytest

from app.migration.safety import NotLocalDatabaseError, assert_local_only, is_local_url, redact_url


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://postgres:postgres@localhost:5434/eventtz",
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        "postgresql://postgres:postgres@[::1]:5434/eventtz",
    ],
)
def test_is_local_url_accepts_loopback_hosts(url: str) -> None:
    assert is_local_url(url) is True


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://postgres:secret@db.supabase.co:5432/postgres",
        "postgresql://postgres:secret@my-project.railway.app:5432/railway",
        "postgresql://postgres:secret@10.0.0.5:5432/postgres",
    ],
)
def test_is_local_url_rejects_remote_hosts(url: str) -> None:
    assert is_local_url(url) is False


def test_assert_local_only_passes_two_local_urls() -> None:
    assert_local_only(
        "postgresql://postgres:postgres@localhost:5434/eventtz",
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        approved_for_hosted=False,
    )


def test_assert_local_only_refuses_a_hosted_url() -> None:
    with pytest.raises(NotLocalDatabaseError):
        assert_local_only(
            "postgresql://postgres:postgres@localhost:5434/eventtz",
            "postgresql://postgres:secret@db.supabase.co:5432/postgres",
            approved_for_hosted=False,
        )


def test_assert_local_only_can_be_overridden() -> None:
    assert_local_only("postgresql://postgres:secret@db.supabase.co:5432/postgres", approved_for_hosted=True)


def test_redact_url_hides_the_password() -> None:
    hidden = redact_url("postgresql://postgres:super-secret@db.supabase.co:5432/postgres")
    assert "super-secret" not in hidden
    assert hidden == "postgresql://postgres:***@db.supabase.co:5432/postgres"


def test_redact_url_leaves_a_passwordless_url_alone() -> None:
    assert redact_url("postgresql://localhost:5434/eventtz") == "postgresql://localhost:5434/eventtz"


def test_not_local_database_error_message_never_repeats_the_password() -> None:
    error = NotLocalDatabaseError("postgresql://postgres:super-secret@db.supabase.co:5432/postgres")
    assert "super-secret" not in str(error)
