import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeBookingsCount, pendingBookingsCount, upcomingAgenda } from "@/domains/vendor-dashboard/dashboardStats";
import type { VendorBookingListItem } from "@/domains/vendor-dashboard/api";

/** Builds a minimal booking, filling only the fields these helpers read. */
function booking(overrides: Partial<VendorBookingListItem>): VendorBookingListItem {
  return {
    booking_request_id: "booking-1",
    booking_status: "accepted",
    event_date: "2026-01-01",
    event_name: "Wedding",
    has_price_update: false,
    initiator: "client",
    payment_status: "unpaid",
    total_label: "£0",
    ...overrides,
  };
}

describe("activeBookingsCount", () => {
  it("counts every booking passed in", () => {
    assert.equal(activeBookingsCount([booking({}), booking({})]), 2);
    assert.equal(activeBookingsCount([]), 0);
  });
});

describe("pendingBookingsCount", () => {
  it("counts only pending bookings", () => {
    const bookings = [
      booking({ booking_request_id: "a", booking_status: "pending" }),
      booking({ booking_request_id: "b", booking_status: "accepted" }),
      booking({ booking_request_id: "c", booking_status: "pending" }),
    ];
    assert.equal(pendingBookingsCount(bookings), 2);
  });
});

describe("upcomingAgenda", () => {
  it("keeps only today-or-later bookings, sorted soonest first", () => {
    const bookings = [
      booking({ booking_request_id: "past", event_date: "2025-01-01" }),
      booking({ booking_request_id: "later", event_date: "2026-03-01" }),
      booking({ booking_request_id: "soonest", event_date: "2026-02-20" }),
      booking({ booking_request_id: "today", event_date: "2026-02-15" }),
    ];
    const today = new Date("2026-02-15T00:00:00Z");
    const result = upcomingAgenda(bookings, today);
    assert.deepEqual(
      result.map((item) => item.booking_request_id),
      ["today", "soonest", "later"],
    );
  });

  it("caps the result at the given limit", () => {
    const bookings = Array.from({ length: 8 }, (_, index) =>
      booking({ booking_request_id: `b${index}`, event_date: `2026-02-${String(index + 1).padStart(2, "0")}` }),
    );
    const today = new Date("2026-02-01T00:00:00Z");
    assert.equal(upcomingAgenda(bookings, today, 3).length, 3);
  });
});
