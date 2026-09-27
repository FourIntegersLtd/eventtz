/**
 * Which client event the booking modal offers, and the fields it copies.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventToPrefill, pickPrimaryClientEvent, type ClientEventForPrefill } from "./clientEventPrefill";

function event(overrides: Partial<ClientEventForPrefill>): ClientEventForPrefill {
  return {
    id: "event-1",
    title: "Wedding",
    event_date: "2026-12-01",
    event_end_date: null,
    event_address: "Leeds",
    status: "active",
    booking_count: 1,
    active_booking_count: 1,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("client event prefill", () => {
  it("copies title, dates, and address", () => {
    assert.deepStrictEqual(
      eventToPrefill(event({ event_end_date: "2026-12-02", event_address: null })),
      {
        eventId: "event-1",
        eventName: "Wedding",
        eventDate: "2026-12-01",
        eventEndDate: "2026-12-02",
        venueAddress: "",
      },
    );
  });

  it("picks the active event with the most active bookings", () => {
    const chosen = pickPrimaryClientEvent([
      event({ id: "quiet", active_booking_count: 0, booking_count: 4, updated_at: "2026-06-01T00:00:00Z" }),
      event({ id: "busy", title: "Birthday", active_booking_count: 2, updated_at: "2026-02-01T00:00:00Z" }),
      event({ id: "archived", status: "archived", active_booking_count: 9 }),
    ]);
    assert.equal(chosen?.id, "busy");
  });
});
