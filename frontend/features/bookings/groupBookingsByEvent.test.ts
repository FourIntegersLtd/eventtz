import { describe, expect, it } from "vitest";
import { groupBookingsByEvent } from "@/features/bookings/groupBookingsByEvent";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { ClientBookingListItem } from "@/lib/clientBookingsApi";

function row(id: string, eventName: string): BookingListRowViewModel {
  return {
    id,
    status: "pending",
    eventName,
    counterpartyLine: "Vendor",
    dateLabel: "15 Aug 2026",
    totalLabel: "£100",
  };
}

function item(
  id: string,
  overrides: Partial<ClientBookingListItem> = {},
): ClientBookingListItem {
  return {
    id,
    status: "pending",
    payment_status: "unpaid",
    event_name: overrides.event_name ?? "Sarah's wedding",
    event_date: overrides.event_date ?? "2026-08-15",
    vendor_display_name: "Vendor",
    initiator: "client",
    total_label: "£100",
    ...overrides,
  } as ClientBookingListItem;
}

describe("groupBookingsByEvent", () => {
  it("groups bookings that share event_id", () => {
    const rows = [row("b1", "Sarah's wedding"), row("b2", "Sarah's wedding")];
    const items = new Map([
      ["b1", item("b1", { event_id: "evt-1", event_title: "Sarah's wedding" })],
      ["b2", item("b2", { event_id: "evt-1", event_title: "Sarah's wedding" })],
    ]);
    const groups = groupBookingsByEvent(rows, items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.eventId).toBe("evt-1");
    expect(groups[0]?.bookingCount).toBe(2);
    expect(groups[0]?.rows.map((r) => r.id)).toEqual(["b1", "b2"]);
  });

  it("keeps legacy bookings without event_id in separate buckets by name+date", () => {
    const rows = [row("b1", "Party A"), row("b2", "Party B")];
    const items = new Map([
      ["b1", item("b1", { event_name: "Party A", event_date: "2026-08-01" })],
      ["b2", item("b2", { event_name: "Party B", event_date: "2026-08-02" })],
    ]);
    const groups = groupBookingsByEvent(rows, items);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.eventId === null)).toBe(true);
  });

  it("orders event groups by latest booking activity, not event date", () => {
    const rows = [row("older-event", "Test custom quote"), row("recent", "Graduation")];
    const items = new Map([
      [
        "older-event",
        item("older-event", {
          event_id: "evt-old",
          event_title: "Test custom quote",
          event_date: "2026-08-21",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-01T10:00:00Z",
        }),
      ],
      [
        "recent",
        item("recent", {
          event_id: "evt-new",
          event_title: "Graduation",
          event_date: "2026-09-30",
          created_at: "2026-08-20T10:00:00Z",
          updated_at: "2026-08-30T18:00:00Z",
        }),
      ],
    ]);
    const groups = groupBookingsByEvent(rows, items);
    expect(groups.map((g) => g.title)).toEqual(["Graduation", "Test custom quote"]);
  });
});
