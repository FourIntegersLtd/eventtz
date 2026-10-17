"""The pure rules behind vendor cancellation review, listing pauses and their emails."""

from __future__ import annotations

from datetime import UTC, datetime

from app.features.bookings.domain_policy import cancellation_review_flag
from app.features.notifications.domain_vendor_emails import (
    vendor_approval_status_email,
    vendor_listing_hidden_email,
    vendor_listing_paused_email,
)
from app.features.vendors.domain_visibility import is_paused, is_publicly_listable

NOW = datetime(2030, 1, 10, 12, 0, tzinfo=UTC)


def test_the_review_flag_starts_at_two_cancellations() -> None:
    """One cancellation is not flagged; two are."""
    assert [cancellation_review_flag(count) for count in (0, 1, 2, 5)] == [False, False, True, True]


def test_a_pause_runs_until_its_end_time_and_then_lapses() -> None:
    """Paused strictly before the end time; not paused at or after it, or with none set."""
    assert is_paused(datetime(2030, 1, 11, tzinfo=UTC), now=NOW) is True
    assert is_paused(NOW, now=NOW) is False
    assert is_paused(datetime(2030, 1, 9, tzinfo=UTC), now=NOW) is False
    assert is_paused(None, now=NOW) is False


def test_a_paused_vendor_is_not_listable_even_when_forced_visible() -> None:
    """The pause beats the visible override; a lapsed pause changes nothing."""
    common = {"approval_status": "approved", "listing_override": "visible", "payouts_ready": True, "now": NOW}
    assert is_publicly_listable(**common, paused_until=datetime(2030, 2, 1, tzinfo=UTC)) is False
    assert is_publicly_listable(**common, paused_until=datetime(2030, 1, 1, tzinfo=UTC)) is True
    assert is_publicly_listable(**common) is True


def test_the_emails_quote_the_reason_and_say_how_to_reply() -> None:
    """Hidden, banned and paused emails carry the reason and the support address."""
    hidden = vendor_listing_hidden_email(business_name="Ada DJ", reason="Photos broke our rules")
    assert "The reason: Photos broke our rules" in hidden.body
    assert "reply to this email" in hidden.body
    banned = vendor_approval_status_email(
        approval_status="banned", business_name="Ada DJ", reason="Repeated no-shows"
    )
    assert "The reason: Repeated no-shows" in banned.body
    paused = vendor_listing_paused_email(
        business_name="Ada DJ", reason="Two cancellations", paused_until_label="14 March 2030"
    )
    assert "until 14 March 2030" in paused.body
    assert "The reason: Two cancellations" in paused.body
