import { describe, expect, it } from "vitest";
import {
  compareBookingsRecentFirst,
  sortBookingListItemsRecentFirst,
} from "@/features/bookings/bookingListOrder";

describe("bookingListOrder", () => {
  it("sorts by updated_at then created_at, most recent first", () => {
    const sorted = sortBookingListItemsRecentFirst([
      { booking_request_id: "old", created_at: "2026-08-01T10:00:00Z", updated_at: null },
      {
        booking_request_id: "new",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-30T12:00:00Z",
      },
    ]);
    expect(sorted.map((row) => row.booking_request_id)).toEqual(["new", "old"]);
  });

  it("compareBookingsRecentFirst orders newer activity before older", () => {
    expect(
      compareBookingsRecentFirst(
        { updated_at: "2026-08-30T12:00:00Z" },
        { updated_at: "2026-08-21T09:00:00Z" },
      ),
    ).toBeLessThan(0);
  });
});
