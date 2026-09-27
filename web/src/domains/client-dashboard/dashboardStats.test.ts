import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countdownLabel,
  daysUntil,
  deriveClientDashboardModel,
  eventDayOver,
  formatEventDate,
  labelMonth,
  labelShortDate,
  monthGridCells,
} from "@/domains/client-dashboard/dashboardStats";
import type { ClientBookingListItem } from "@/domains/client-dashboard/api";

/** Builds a minimal booking, filling only the fields the dashboard logic reads. */
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

describe("deriveClientDashboardModel bookingsByDate", () => {
  it("spreads a multi-day booking across every day it runs, skipping days before today", () => {
    const model = deriveClientDashboardModel(
      [booking({ booking_request_id: "b1", event_date: "2026-02-14", event_end_date: "2026-02-16" })],
      [],
      new Date(2026, 1, 15),
    );
    assert.deepEqual(Object.keys(model.bookingsByDate), ["2026-02-15", "2026-02-16"]);
    assert.equal(model.bookingsByDate["2026-02-15"]?.[0]?.booking_request_id, "b1");
  });

  it("excludes accepted bookings whose last day already passed", () => {
    const model = deriveClientDashboardModel(
      [booking({ booking_request_id: "past", event_date: "2026-01-10" })],
      [],
      new Date(2026, 1, 15),
    );
    assert.deepEqual(Object.keys(model.bookingsByDate), []);
  });
});

describe("deriveClientDashboardModel summary counts", () => {
  it("splits pending bookings into awaiting-vendor and awaiting-client buckets", () => {
    const model = deriveClientDashboardModel(
      [
        booking({ booking_request_id: "client-initiated", booking_status: "pending", initiator: "client" }),
        booking({ booking_request_id: "vendor-quote", booking_status: "pending", initiator: "vendor" }),
      ],
      [],
      new Date(2026, 1, 15),
    );
    assert.equal(model.awaitingVendorCount, 1);
    assert.equal(model.awaitingClientCount, 1);
  });

  it("collects completed bookings with no review yet", () => {
    const model = deriveClientDashboardModel(
      [],
      [
        booking({ booking_request_id: "r1", has_review: false }),
        booking({ booking_request_id: "r2", has_review: true }),
      ],
      new Date(2026, 1, 15),
    );
    assert.deepEqual(
      model.needsReview.map((item) => item.booking_request_id),
      ["r1"],
    );
  });
});

describe("deriveClientDashboardModel upcomingAgenda", () => {
  it("keeps accepted upcoming bookings sorted soonest first, capped at five", () => {
    const bookings = Array.from({ length: 8 }, (_, index) =>
      booking({ booking_request_id: `b${index + 1}`, event_date: `2026-02-${String(index + 1).padStart(2, "0")}` }),
    );
    const model = deriveClientDashboardModel(bookings, [], new Date(2026, 1, 1));
    assert.deepEqual(
      model.upcomingAgenda.map((item) => item.booking_request_id),
      ["b1", "b2", "b3", "b4", "b5"],
    );
  });
});

describe("countdownLabel", () => {
  it("labels today, tomorrow, in-progress and future days", () => {
    const today = new Date(2026, 1, 15);
    assert.equal(countdownLabel(daysUntil("2026-02-15", today)), "Today");
    assert.equal(countdownLabel(daysUntil("2026-02-16", today)), "Tomorrow");
    assert.equal(countdownLabel(daysUntil("2026-02-13", today)), "In progress");
    assert.equal(countdownLabel(daysUntil("2026-02-19", today)), "4 days to go");
  });
});

describe("formatEventDate", () => {
  it("formats a YYYY-MM-DD event date", () => {
    assert.equal(formatEventDate("2026-07-12"), "Sun, 12 Jul 2026");
  });
});

describe("eventDayOver", () => {
  it("is false until the event's last day has fully passed (UTC)", () => {
    assert.equal(eventDayOver("2026-02-14", null, new Date("2026-02-14T23:59:59Z")), false);
    assert.equal(eventDayOver("2026-02-14", null, new Date("2026-02-15T00:00:00Z")), true);
  });

  it("uses the end date for multi-day events", () => {
    assert.equal(eventDayOver("2026-02-14", "2026-02-16", new Date("2026-02-16T00:00:00Z")), false);
    assert.equal(eventDayOver("2026-02-14", "2026-02-16", new Date("2026-02-17T00:00:00Z")), true);
  });
});

describe("monthGridCells", () => {
  it("lays out February 2026 Monday-first, padded to a full week", () => {
    const cells = monthGridCells(new Date(2026, 1, 1));
    assert.equal(cells.length, 35);
    assert.equal(cells.length % 7, 0);
    assert.equal(cells[0], null);
    assert.equal(cells[5], null);
    assert.deepEqual(cells[6], { key: "2026-02-01", day: 1 });
    assert.equal(cells[34], null);
  });
});

describe("labelMonth and labelShortDate", () => {
  it("formats the month heading and a compact date", () => {
    assert.equal(labelMonth(new Date(2026, 1, 1)), "February 2026");
    assert.equal(labelShortDate("2026-02-15"), "Sun 15 Feb");
  });
});
