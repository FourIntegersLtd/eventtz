"""The dashboard feed's shaping and ordering, with no I/O."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from app.features.notifications.domain_booking_copy import _COPY
from app.features.notifications.domain_feed import (
    NOTICE_KIND_TOPICS,
    PAYMENT_NOTICE_KINDS,
    booking_item,
    chat_summary_item,
    dispute_item,
    topic_scope,
)
from app.features.notifications.rows import DisputeNoticeRow, StoredNotificationRow


def test_booking_item_is_titled_by_the_event_and_links_to_the_booking() -> None:
    """The event name is the title; a quote keeps its stored body; unread until `read_at` is set."""
    notice = StoredNotificationRow(
        id="notice-1",
        booking_id="booking-1",
        kind="vendor_quote_received",
        body="Total: GBP 300",
        created_at="2026-09-26T10:00:00+00:00",
    )
    assert booking_item(notice, portal="client", event_name="Ada's 30th") == {
        "kind": "booking_update",
        "created_at": "2026-09-26T10:00:00+00:00",
        "title": "Ada's 30th",
        "body": "Total: GBP 300",
        "notification_id": "notice-1",
        "booking_id": "booking-1",
        "href": "/client/bookings/booking-1",
        "unread": True,
    }
    read_notice = notice.model_copy(update={"read_at": "2026-09-26T11:00:00+00:00"})
    assert booking_item(read_notice, portal="vendor", event_name=None)["unread"] is False


def test_dispute_item_is_titled_by_status_and_dated_by_its_last_update() -> None:
    """Underscores become spaces; a blank summary is no body; a missing status reads "open"."""
    dispute = DisputeNoticeRow(
        status="under_review",
        summary="  Late arrival  ",
        created_at="2026-09-01T00:00:00+00:00",
        updated_at="2026-09-02T00:00:00+00:00",
    )
    assert dispute_item(dispute, portal="vendor") == {
        "kind": "dispute_update",
        "created_at": "2026-09-02T00:00:00+00:00",
        "title": "Dispute: under review",
        "body": "Late arrival",
        "href": "/vendor/bookings?tab=disputes",
        "unread": None,
    }
    bare = dispute_item(
        DisputeNoticeRow(summary="  ", created_at="2026-09-01T00:00:00+00:00"), portal="client"
    )
    assert (bare["title"], bare["body"], bare["created_at"]) == (
        "Dispute: open",
        None,
        "2026-09-01T00:00:00+00:00",
    )


def test_chat_summary_counts_unread_messages_and_is_absent_at_zero() -> None:
    """One message is singular; none gives no item."""
    assert chat_summary_item(0, portal="client") is None
    assert chat_summary_item(1, portal="client") == {
        "kind": "chat_unread_summary",
        "created_at": None,
        "title": "Unread messages",
        "body": "You have 1 unread message.",
        "href": "/client/messages",
        "unread": True,
    }
    three = chat_summary_item(3, portal="vendor")
    assert three is not None
    assert three["body"] == "You have 3 unread messages."


def _migration_0007_kinds() -> set[str]:
    """Every notice kind the database accepts: migration 0007's old and new kind lists."""
    path = next((Path(__file__).parents[2] / "alembic" / "versions").glob("0007_*.py"))
    spec = importlib.util.spec_from_file_location("migration_0007", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return {*module.OLD_NOTIFICATION_KINDS, *module.NEW_NOTIFICATION_KINDS}


def test_every_stored_notice_kind_has_a_deliberate_topic() -> None:
    """A new kind in the check constraint or the copy table must be mapped, not left to the default."""
    known = _migration_0007_kinds() | set(_COPY)
    assert known <= set(NOTICE_KIND_TOPICS)
    assert set(NOTICE_KIND_TOPICS.values()) == {"bookings", "payments"}


def test_payment_notice_is_in_payments_whatever_its_copy_says() -> None:
    """The topic follows the stored kind: no "payment" in the copy, still payments."""
    notice = StoredNotificationRow(
        id="n1",
        booking_id="b1",
        kind="vendor_upfront_released",
        body=None,
        created_at="2026-09-26T10:00:00+00:00",
    )
    item = booking_item(notice, portal="vendor", event_name="Ada's 30th")
    assert "payment" not in f"{item['title']} {item['body']}".lower()
    assert notice.kind in PAYMENT_NOTICE_KINDS


def test_non_payment_notice_that_says_paid_is_not_payments() -> None:
    """Copy wording never decides the topic; deposit claim outcomes are bookings, the refund is payments."""
    assert "booking_accepted" not in PAYMENT_NOTICE_KINDS
    assert "deposit_claim_resolved" not in PAYMENT_NOTICE_KINDS
    assert "vendor_deposit_claim_resolved" not in PAYMENT_NOTICE_KINDS
    assert "deposit_refunded" in PAYMENT_NOTICE_KINDS


def test_topic_scope_says_which_sources_each_topic_reads() -> None:
    """Payments is a kind list; bookings is every notice and dispute; messages is chat only."""
    everything = topic_scope("all")
    assert (everything.notices, everything.disputes, everything.chat_summary) == (True, True, True)
    assert everything.kinds_in is None
    payments = topic_scope("payments")
    assert (payments.notices, payments.disputes, payments.chat_summary) == (True, False, False)
    assert payments.kinds_in == PAYMENT_NOTICE_KINDS
    bookings = topic_scope("bookings")
    assert (bookings.notices, bookings.disputes, bookings.chat_summary) == (True, True, False)
    assert bookings.kinds_in is None
    messages = topic_scope("messages")
    assert (messages.notices, messages.disputes, messages.chat_summary) == (False, False, True)
