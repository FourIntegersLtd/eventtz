"""The dashboard feed's shaping and ordering, with no I/O."""

from __future__ import annotations

from app.features.notifications.domain_feed import (
    FEED_LIMIT,
    booking_item,
    chat_summary_item,
    dispute_item,
    newest_first,
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


def test_feed_is_newest_first_with_undated_items_last_and_capped() -> None:
    """Items sort by their ISO time, descending; the chat summary (no time) goes to the end."""
    older = {"created_at": "2026-09-01T00:00:00+00:00", "title": "older"}
    newer = {"created_at": "2026-09-02T00:00:00+00:00", "title": "newer"}
    undated = {"created_at": None, "title": "chat"}
    assert [item["title"] for item in newest_first([undated, older, newer])] == ["newer", "older", "chat"]
    many = [{"created_at": f"2026-09-{day:02d}", "title": str(day)} for day in range(1, 31)]
    assert len(newest_first(many)) == FEED_LIMIT
    assert newest_first(many)[0]["title"] == "30"
