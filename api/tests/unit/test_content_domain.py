"""Content rules that the black-box suite cannot see: webhook payloads, audience rules, edit mapping."""

from __future__ import annotations

import pytest

from app.features.content.domain_blog import post_changes
from app.features.content.domain_contact import (
    AUTOMATION_SUBJECTS,
    SUBJECT_LABELS,
    automation_payload,
    booking_reference,
    clean_message,
)
from app.features.content.domain_help import audience_values, resolve_audience
from app.features.content.errors import AudienceMismatch, InvalidBookingReference, MessageTooShort


def test_staff_default_to_admin_articles_and_may_preview_a_portal() -> None:
    assert resolve_audience("admin", None) == "admin"
    assert resolve_audience("admin", "vendor") == "vendor"
    assert resolve_audience("admin", "nonsense") == "admin"


def test_clients_only_read_their_own_portal() -> None:
    assert resolve_audience("client", None) == "client"
    assert resolve_audience("client", "client") == "client"
    with pytest.raises(AudienceMismatch):
        resolve_audience("client", "vendor")


def test_admin_articles_never_mix_in_shared_ones() -> None:
    assert audience_values("admin") == ["admin"]
    assert audience_values("vendor") == ["vendor", "both"]


def test_contact_message_is_trimmed_before_the_length_check() -> None:
    assert clean_message("  ten chars!  ") == "ten chars!"
    with pytest.raises(MessageTooShort):
        clean_message("   short    ")


def test_booking_reference_blank_is_none_and_non_uuid_is_refused() -> None:
    assert booking_reference(None) is None
    assert booking_reference("   ") is None
    assert (
        booking_reference(" 11111111-1111-4111-8111-111111111111 ") == "11111111-1111-4111-8111-111111111111"
    )
    with pytest.raises(InvalidBookingReference):
        booking_reference("BK-123")


def test_bug_booking_and_payment_messages_go_to_automation() -> None:
    assert {"feedback_bug", "booking_problem", "payments"} == AUTOMATION_SUBJECTS
    assert AUTOMATION_SUBJECTS.issubset(SUBJECT_LABELS)


def test_automation_payload_shape_matches_the_baseline() -> None:
    payload = automation_payload(
        submission_id="sub-1",
        portal="vendor",
        user_id="user-1",
        user_email=None,
        subject="payments",
        message="Where is my payout?",
        booking_id=None,
    )
    assert payload == {
        "source": "eventtz_contact",
        "submission_id": "sub-1",
        "portal": "vendor",
        "user_id": "user-1",
        "user_email": None,
        "subject": "payments",
        "subject_label": "Payments",
        "message": "Where is my payout?",
        "booking_id": None,
    }


def test_post_changes_touch_only_sent_fields() -> None:
    assert post_changes({}) == {}
    assert post_changes({"title": "  "}) == {"title": "Untitled"}
    assert post_changes({"title": None}) == {}
    assert post_changes({"subtitle": "  ", "excerpt": " Hi "}) == {"subtitle": None, "excerpt": "Hi"}
    assert post_changes({"author_name": "a" * 200}) == {"author_name": "a" * 120}
    assert post_changes({"body_html": "<script>x</script><p>ok</p>"}) == {"body_html": "x<p>ok</p>"}
