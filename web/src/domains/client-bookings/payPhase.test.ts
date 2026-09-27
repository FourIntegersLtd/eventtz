import test from "node:test";
import assert from "node:assert/strict";
import { initialPayPhase } from "@/domains/client-bookings/payPhase";

test("initialPayPhase asks for a venue when an accepted unpaid booking has no address", () => {
  assert.equal(initialPayPhase({ booking_status: "accepted", payment_status: "unpaid" }), "venue");
  assert.equal(
    initialPayPhase({ booking_status: "accepted", payment_status: "unpaid", event_address: "   " }),
    "venue",
  );
});

test("initialPayPhase opens the safety step when the booking can be paid and has a venue", () => {
  assert.equal(
    initialPayPhase({ booking_status: "accepted", payment_status: "pending", event_address: "12 Park Lane" }),
    "safety",
  );
});

test("initialPayPhase refuses a booking that cannot be paid", () => {
  assert.equal(
    initialPayPhase({ booking_status: "accepted", payment_status: "paid", event_address: "12 Park Lane" }),
    "notPayable",
  );
});
