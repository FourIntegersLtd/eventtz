"""Account closure rules: which gate refuses, in what order, and which stored files are ours."""

from __future__ import annotations

from dataclasses import dataclass

from app.features.identity.domain_deletion import (
    failing_gate,
    is_open_dispute,
    own_object_key,
    user_storage_prefix,
)


@dataclass(frozen=True)
class Booking:
    """A booking as the gates see it."""

    status: str
    payment_status: str = "unpaid"
    event_day_over: bool = False


def test_no_bookings_and_no_dispute_may_close() -> None:
    assert failing_gate([], has_open_dispute=False) is None


def test_pending_or_paid_money_blocks() -> None:
    assert failing_gate([Booking("accepted", "paid")], has_open_dispute=False) == "money_in_flight"
    assert failing_gate([Booking("pending", "pending")], has_open_dispute=False) == "money_in_flight"


def test_released_or_refunded_money_does_not_block() -> None:
    finished = [Booking("completed", "payout_released"), Booking("cancelled", "refunded")]
    assert failing_gate(finished, has_open_dispute=False) is None


def test_an_accepted_booking_blocks_until_its_event_day_is_over() -> None:
    assert failing_gate([Booking("accepted")], has_open_dispute=False) == "active_booking"
    assert failing_gate([Booking("accepted", event_day_over=True)], has_open_dispute=False) is None


def test_a_pending_unpaid_enquiry_never_blocks() -> None:
    assert failing_gate([Booking("pending")], has_open_dispute=False) is None


def test_an_open_dispute_blocks() -> None:
    assert failing_gate([], has_open_dispute=True) == "open_dispute"


def test_money_beats_active_beats_dispute() -> None:
    active_then_paid = [Booking("accepted"), Booking("accepted", "paid")]
    assert failing_gate(active_then_paid, has_open_dispute=True) == "money_in_flight"
    assert failing_gate([Booking("accepted")], has_open_dispute=True) == "active_booking"


def test_only_open_and_under_review_disputes_count() -> None:
    assert [is_open_dispute(status) for status in ("open", "under_review", "resolved", "closed")] == [
        True,
        True,
        False,
        False,
    ]


def test_storage_prefix_refuses_ids_that_could_escape_it() -> None:
    assert user_storage_prefix("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed") == (
        "users/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed/"
    )
    assert [user_storage_prefix(user_id) for user_id in ("", ".", "..", "a/b")] == [None, None, None, None]


def test_only_our_storage_urls_give_a_key() -> None:
    assert own_object_key("https://Files.Example/reviews/a%20b.jpg", "files.example") == "reviews/a b.jpg"
    assert own_object_key("https://elsewhere.example/reviews/a.jpg", "files.example") is None
    assert own_object_key("https://files.example/", "files.example") is None
