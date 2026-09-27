import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatNotificationTimestamp,
  formatUnreadCount,
  notificationKindLabel,
} from "@/domains/notifications/notificationFormatting";

describe("notificationKindLabel", () => {
  it("labels a booking update", () => {
    assert.equal(notificationKindLabel("booking_update"), "Booking");
  });

  it("labels a dispute update", () => {
    assert.equal(notificationKindLabel("dispute_update"), "Dispute");
  });

  it("labels the unread-chat summary", () => {
    assert.equal(notificationKindLabel("chat_unread_summary"), "Messages");
  });
});

describe("formatNotificationTimestamp", () => {
  it("formats a date and 24-hour time", () => {
    assert.equal(formatNotificationTimestamp("2026-09-26T14:05:00.000Z"), "26 Sept, 14:05");
  });

  it("returns an empty string for a missing timestamp", () => {
    assert.equal(formatNotificationTimestamp(null), "");
  });

  it("returns an empty string for an unparsable timestamp", () => {
    assert.equal(formatNotificationTimestamp("not-a-date"), "");
  });
});

describe("formatUnreadCount", () => {
  it("shows the literal count under 100", () => {
    assert.equal(formatUnreadCount(3), "3");
  });

  it("caps at 99+", () => {
    assert.equal(formatUnreadCount(250), "99+");
  });
});
