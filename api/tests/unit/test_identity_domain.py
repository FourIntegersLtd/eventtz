"""Account rules: password strength, one-click tokens, email links, verification and settings changes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.features.identity.domain_accounts import (
    MIN_TOKEN_LENGTH,
    contact_settings_changes,
    hash_token,
    needs_email_verification,
    new_one_click_token,
    normalise_email,
    onboarding_changes,
    parse_timestamp,
    password_problem,
    reset_password_link,
    token_expiry,
    token_is_well_formed,
    token_state,
    verify_email_link,
)

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)


def test_emails_are_trimmed_and_lower_cased() -> None:
    """Sign-up, sign-in and lookups all compare the same form of an address."""
    assert normalise_email("  Ada@Example.COM ") == "ada@example.com"
    assert normalise_email(None) == ""


def test_clients_and_vendors_only_need_six_characters() -> None:
    """Non-staff passwords have a length rule and nothing else."""
    assert password_problem("abcdef", "client") is None
    assert password_problem("abcde", "vendor") == "Password must be at least 6 characters."
    assert password_problem("abcde", None) == "Password must be at least 6 characters."


def test_staff_passwords_need_upper_case_a_number_and_a_symbol() -> None:
    """Each missing class is named, in order, so the admin sees what to fix."""
    assert password_problem("Ab1!", "admin") == "Admin password must be at least 6 characters."
    assert password_problem("abcdef1!", "admin") == "Admin password must include an uppercase letter."
    assert password_problem("Abcdefg!", "admin") == "Admin password must include a number."
    assert password_problem("Abcdef12", "admin") == "Admin password must include a symbol."
    assert password_problem("Abcdef1!", "admin") is None


def test_a_new_token_is_stored_only_as_its_hash() -> None:
    """The raw token goes in the link; the database holds its SHA-256."""
    raw_token, token_hash = new_one_click_token()
    assert token_hash == hash_token(raw_token)
    assert token_hash != raw_token
    assert len(token_hash) == 64
    assert token_is_well_formed(raw_token)


def test_short_or_missing_tokens_are_refused_without_a_lookup() -> None:
    """Anything shorter than an issued token cannot be one."""
    assert not token_is_well_formed(None)
    assert not token_is_well_formed("   ")
    assert not token_is_well_formed("x" * (MIN_TOKEN_LENGTH - 1))
    assert token_is_well_formed(" " + "x" * MIN_TOKEN_LENGTH + " ")


def test_tokens_work_for_an_hour_and_only_once() -> None:
    """Used beats expired; an unreadable expiry counts as expired."""
    expires_at = token_expiry(NOW).isoformat()
    assert token_expiry(NOW) == NOW + timedelta(hours=1)
    assert token_state(used_at=None, expires_at=expires_at, now=NOW) == "usable"
    assert token_state(used_at=NOW.isoformat(), expires_at=expires_at, now=NOW) == "used"
    assert token_state(used_at=None, expires_at=expires_at, now=NOW + timedelta(hours=2)) == "expired"
    assert token_state(used_at=None, expires_at="not a date", now=NOW) == "expired"
    assert token_state(used_at=None, expires_at=None, now=NOW) == "expired"


def test_postgres_timestamps_parse_with_or_without_a_zone() -> None:
    """`Z`, offsets and naive values (taken as UTC) all become aware datetimes."""
    assert parse_timestamp("2026-09-26T12:00:00Z") == NOW
    assert parse_timestamp("2026-09-26T13:00:00+01:00") == NOW
    assert parse_timestamp("2026-09-26T12:00:00") == NOW
    assert parse_timestamp("") is None


def test_email_links_point_at_the_public_website() -> None:
    """Staff reset links open the admin portal's reset page."""
    assert verify_email_link("tok") == "https://www.eventtz.com/verify-email?token=tok"
    assert (
        reset_password_link("tok", user_type="vendor") == "https://www.eventtz.com/reset-password?token=tok"
    )
    assert (
        reset_password_link("tok", user_type="admin")
        == "https://www.eventtz.com/reset-password?portal=admin&token=tok"
    )


def test_only_clients_and_vendors_with_a_profile_must_verify() -> None:
    """Staff and accounts that predate verification (no `users` row) sign in without it."""
    assert needs_email_verification(user_type="client", profile_exists=True, verified_at=None)
    assert not needs_email_verification(user_type="client", profile_exists=True, verified_at=NOW.isoformat())
    assert not needs_email_verification(user_type="admin", profile_exists=True, verified_at=None)
    assert not needs_email_verification(user_type="vendor", profile_exists=False, verified_at=None)


def test_contact_settings_leave_omitted_fields_alone() -> None:
    """Only the fields sent are changed; a blank phone clears it."""
    assert (
        contact_settings_changes(
            user_type="client", contact_phone=None, share_email=None, share_phone=None, share_address=None
        )
        == {}
    )
    assert contact_settings_changes(
        user_type="client", contact_phone="  ", share_email=False, share_phone=None, share_address=True
    ) == {"contact_phone": None, "share_email": False, "share_address": True}


def test_vendors_cannot_set_phone_or_address_in_contact_settings() -> None:
    """Vendors keep their phone on the vendor profile and share no address."""
    assert contact_settings_changes(
        user_type="vendor", contact_phone="0700", share_email=True, share_phone=False, share_address=True
    ) == {"share_email": True, "share_phone": False}


def test_onboarding_sets_the_name_and_or_the_completed_time() -> None:
    """A whitespace-only name clears it; completion records `now`."""
    assert onboarding_changes(preferred_name=None, mark_completed=False, now=NOW) == {}
    assert onboarding_changes(preferred_name="  Ada ", mark_completed=True, now=NOW) == {
        "preferred_name": "Ada",
        "client_onboarding_completed_at": NOW.isoformat(),
    }
    assert onboarding_changes(preferred_name="   ", mark_completed=False, now=NOW) == {"preferred_name": None}
