import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayDividerLabel,
  formatConversationActivity,
  formatMessageTime,
  formatUnreadBadge,
  groupMessagesByDay,
  peerInitials,
} from "@/domains/vendor-messages/messageFormatting";

const NOW = new Date("2026-09-26T15:30:00.000Z");

describe("dayDividerLabel", () => {
  it("labels the same UTC day as Today", () => {
    assert.equal(dayDividerLabel("2026-09-26T09:00:00.000Z", NOW), "Today");
  });

  it("labels the previous UTC day as Yesterday", () => {
    assert.equal(dayDividerLabel("2026-09-25T23:59:00.000Z", NOW), "Yesterday");
  });

  it("spells out an older same-year date without the year", () => {
    assert.equal(dayDividerLabel("2026-01-02T00:00:00.000Z", NOW), "2 January");
  });

  it("includes the year for a date in a different year", () => {
    assert.equal(dayDividerLabel("2025-12-31T00:00:00.000Z", NOW), "31 December 2025");
  });
});

describe("groupMessagesByDay", () => {
  it("keeps consecutive same-day messages in one group, in order", () => {
    const groups = groupMessagesByDay(
      [
        { created_at: "2026-09-25T09:00:00.000Z" },
        { created_at: "2026-09-25T10:00:00.000Z" },
        { created_at: "2026-09-26T09:00:00.000Z" },
      ],
      NOW,
    );
    assert.deepEqual(
      groups.map((group) => ({ label: group.label, count: group.messages.length })),
      [
        { label: "Yesterday", count: 2 },
        { label: "Today", count: 1 },
      ],
    );
  });

  it("returns no groups for no messages", () => {
    assert.deepEqual(groupMessagesByDay([], NOW), []);
  });
});

describe("formatMessageTime", () => {
  it("formats a 24-hour clock time", () => {
    assert.equal(formatMessageTime("2026-09-26T14:05:00.000Z"), "14:05");
  });

  it("returns an empty string for a missing timestamp", () => {
    assert.equal(formatMessageTime(null), "");
  });
});

describe("formatConversationActivity", () => {
  it("shows a time for an activity today", () => {
    assert.equal(formatConversationActivity("2026-09-26T08:15:00.000Z", NOW), "08:15");
  });

  it("shows a short date for an earlier activity", () => {
    assert.equal(formatConversationActivity("2026-09-20T08:15:00.000Z", NOW), "20 Sept");
  });
});

describe("formatUnreadBadge", () => {
  it("shows the literal count under 100", () => {
    assert.equal(formatUnreadBadge(7), "7");
  });

  it("caps at 99+", () => {
    assert.equal(formatUnreadBadge(140), "99+");
  });
});

describe("peerInitials", () => {
  it("takes the first two words' initials", () => {
    assert.equal(peerInitials("Jordan Baker"), "JB");
  });

  it("falls back to the first two characters of one word", () => {
    assert.equal(peerInitials("jordan"), "JO");
  });

  it("falls back to a question mark for an empty name", () => {
    assert.equal(peerInitials("   "), "?");
  });
});
