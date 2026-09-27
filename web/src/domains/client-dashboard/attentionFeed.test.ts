import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientAttentionItems, dashboardNotificationUpdates, sortAttentionItems } from "@/domains/client-dashboard/attentionFeed";
import type { ClientBookingListItem, NotificationFeedItem } from "@/domains/client-dashboard/api";

/** Builds a minimal booking, filling only the fields the attention classifier reads. */
function booking(overrides: Partial<ClientBookingListItem>): ClientBookingListItem {
  return {
    booking_request_id: "booking-1",
    booking_status: "accepted",
    event_date: "2026-01-01",
    event_name: "Wedding",
    has_price_update: false,
    has_review: false,
    initiator: "client",
    payment_status: "unpaid",
    total_label: "£0",
    vendor_display_name: "DJ Dan",
    vendor_user_id: "vendor-1",
    ...overrides,
  };
}

/** Builds a minimal notification feed item. */
function update(overrides: Partial<NotificationFeedItem>): NotificationFeedItem {
  return {
    kind: "booking_update",
    title: "Update",
    unread: true,
    ...overrides,
  };
}

const NOW = new Date("2026-02-15T00:00:00Z");

describe("buildClientAttentionItems quotes", () => {
  it("raises a vendor quote as an urgent item", () => {
    const items = buildClientAttentionItems({
      activeBookings: [booking({ booking_request_id: "q1", booking_status: "pending", initiator: "vendor", vendor_display_name: "Caterer Co", event_name: "Anniversary", event_date: "2026-03-01" })],
      needsReview: [],
      chatUnread: 0,
      updates: [],
      now: NOW,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "quote-q1");
    assert.equal(items[0]?.tone, "urgent");
    assert.equal(items[0]?.title, "Quote from Caterer Co");
    assert.equal(items[0]?.href, "/client/bookings/q1");
  });
});

describe("buildClientAttentionItems completion", () => {
  it("is gated off until the event day is over", () => {
    const active = [booking({ booking_request_id: "c1", booking_status: "accepted", payment_status: "paid", completion_waiting_on: "client", event_date: "2026-02-14", vendor_display_name: "Caterer Co" })];
    const before = buildClientAttentionItems({ activeBookings: active, needsReview: [], chatUnread: 0, updates: [], now: new Date("2026-02-14T00:00:00Z") });
    assert.equal(before.length, 0);

    const after = buildClientAttentionItems({ activeBookings: active, needsReview: [], chatUnread: 0, updates: [], now: new Date("2026-02-16T00:00:00Z") });
    assert.equal(after.length, 1);
    assert.equal(after[0]?.id, "completion-confirm-c1");
    assert.equal(after[0]?.title, "How did your event go?");
  });

  it("splits completion into vendor-waiting (info) and client-confirm (urgent)", () => {
    const waitItems = buildClientAttentionItems({
      activeBookings: [booking({ booking_request_id: "w1", booking_status: "accepted", payment_status: "paid", completion_waiting_on: "vendor", event_date: "2026-02-14", vendor_display_name: "Caterer Co" })],
      needsReview: [],
      chatUnread: 0,
      updates: [],
      now: new Date("2026-02-16T00:00:00Z"),
    });
    assert.equal(waitItems[0]?.id, "completion-wait-w1");
    assert.equal(waitItems[0]?.tone, "info");
  });
});

describe("buildClientAttentionItems chat summary", () => {
  it("raises an unread-message item, pluralising correctly", () => {
    const single = buildClientAttentionItems({ activeBookings: [], needsReview: [], chatUnread: 1, updates: [], now: NOW });
    assert.equal(single[0]?.title, "1 unread message");
    assert.equal(single[0]?.href, "/client/help");

    const many = buildClientAttentionItems({ activeBookings: [], needsReview: [], chatUnread: 3, updates: [], now: NOW });
    assert.equal(many[0]?.title, "3 unread messages");
  });

  it("omits the item when there is nothing unread", () => {
    const items = buildClientAttentionItems({ activeBookings: [], needsReview: [], chatUnread: 0, updates: [], now: NOW });
    assert.equal(items.length, 0);
  });
});

describe("dashboardNotificationUpdates", () => {
  it("drops the chat summary, read items and updates covered by a live booking row", () => {
    const updates = [
      update({ title: "Covered", booking_id: "q1", notification_id: "n1" }),
      update({ title: "Kept", booking_id: "other", notification_id: "n2" }),
      update({ title: "Chat summary", kind: "chat_unread_summary" }),
      update({ title: "Already read", unread: false }),
    ];
    const result = dashboardNotificationUpdates(updates, new Set(["q1"]));
    assert.deepEqual(result.map((item) => item.title), ["Kept"]);
  });
});

describe("buildClientAttentionItems review nudges", () => {
  it("caps the rating nudges at three and marks each with its booking", () => {
    const needsReview = [1, 2, 3, 4].map((index) =>
      booking({ booking_request_id: `r${index}`, has_review: false, vendor_display_name: `Vendor ${index}` }),
    );
    const items = buildClientAttentionItems({ activeBookings: [], needsReview, chatUnread: 0, updates: [], now: NOW });
    const reviews = items.filter((item) => item.tone === "positive");
    assert.equal(reviews.length, 3);
    assert.equal(reviews[0]?.title, "Rate Vendor 1");
    assert.equal(reviews[0]?.rateBookingId, "r1");
  });
});

describe("sortAttentionItems", () => {
  it("sorts by priority, lowest first, keeping insertion order on ties", () => {
    const sorted = sortAttentionItems([
      { id: "low", priority: 3, tone: "positive", title: "Rate", href: "/x" },
      { id: "high", priority: 0, tone: "urgent", title: "Quote", href: "/y" },
    ]);
    assert.deepEqual(sorted.map((item) => item.id), ["high", "low"]);
  });
});
