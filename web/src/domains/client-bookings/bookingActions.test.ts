import test from "node:test";
import assert from "node:assert/strict";
import {
  autoReleaseLine,
  bookingCanBePaid,
  bookingNeedsVenue,
  clientBookingActions,
  completionBannerState,
  completionWaitingCopy,
  eventDayOver,
  isPayoutReleasePending,
} from "@/domains/client-bookings/bookingActions";

function source(overrides: Partial<Parameters<typeof clientBookingActions>[0]> = {}) {
  return {
    booking_status: "pending",
    payment_status: "unpaid",
    initiator: "client" as const,
    ...overrides,
  };
}

test("a vendor's unanswered quote can be accepted/declined but not cancelled", () => {
  const actions = clientBookingActions(source({ booking_status: "pending", initiator: "vendor" }));
  assert.equal(actions.canRespondToQuote, true);
  assert.equal(actions.canCancel, false);
});

test("a client's pending request with a price update needs a response", () => {
  const actions = clientBookingActions(source({ initiator: "client", vendor_adjustments: [{ id: "a" }] }));
  assert.equal(actions.canRespondToPriceUpdate, true);
  assert.equal(actions.showUpdatedPriceBanner, true);
});

test("an accepted paid booking can be confirmed once, then not again", () => {
  const base = { booking_status: "accepted", payment_status: "paid", initiator: "client" as const };
  assert.equal(clientBookingActions(source(base)).canConfirmCompletion, true);
  assert.equal(
    clientBookingActions(source({ ...base, client_completion_confirmed_at: "2026-07-12T00:00:00Z" })).canConfirmCompletion,
    false,
  );
});

test("an accepted unpaid booking is due for payment", () => {
  const actions = clientBookingActions(source({ booking_status: "accepted", payment_status: "unpaid" }));
  assert.equal(actions.paymentDue, true);
  assert.equal(actions.canCancel, true);
});

test("a booking paid out can no longer be cancelled", () => {
  const actions = clientBookingActions(source({ booking_status: "accepted", payment_status: "payout_released" }));
  assert.equal(actions.canCancel, false);
});

test("a cancelled, refunded booking shows the refunded notice", () => {
  const actions = clientBookingActions(source({ booking_status: "cancelled", payment_status: "refunded" }));
  assert.equal(actions.showCancelledRefunded, true);
  assert.equal(actions.canCancel, false);
});

test("payout release is pending only when both sides confirmed and the booking is paid", () => {
  assert.equal(
    isPayoutReleasePending({
      booking_status: "accepted",
      payment_status: "paid",
      client_completion_confirmed_at: "x",
      vendor_completion_confirmed_at: "y",
    }),
    true,
  );
  assert.equal(isPayoutReleasePending({ booking_status: "accepted", payment_status: "paid" }), false);
});

test("bookingCanBePaid requires an accepted status and an unpaid/pending payment", () => {
  assert.equal(bookingCanBePaid({ booking_status: "accepted", payment_status: "unpaid" }), true);
  assert.equal(bookingCanBePaid({ booking_status: "accepted", payment_status: "pending" }), true);
  assert.equal(bookingCanBePaid({ booking_status: "accepted", payment_status: "paid" }), false);
  assert.equal(bookingCanBePaid({ booking_status: "pending", payment_status: "unpaid" }), false);
});

test("bookingNeedsVenue is true when the address is blank", () => {
  assert.equal(bookingNeedsVenue(null), true);
  assert.equal(bookingNeedsVenue(""), true);
  assert.equal(bookingNeedsVenue("   "), true);
  assert.equal(bookingNeedsVenue("12 High Street"), false);
});

test("eventDayOver is true only after the event's last day (UTC) has passed", () => {
  assert.equal(eventDayOver("2020-01-01"), true);
  assert.equal(eventDayOver("2999-01-01"), false);
  assert.equal(eventDayOver("2020-01-01", "2020-01-02"), true);
  assert.equal(eventDayOver("not-a-date"), false);
});

test("completionWaitingCopy speaks to the client viewer", () => {
  assert.deepEqual(completionWaitingCopy("both", "client"), {
    title: "How did your event go?",
    body: "If everything went well, confirm it's complete so the vendor can be paid. If something went wrong, report a problem.",
  });
  assert.equal(completionWaitingCopy("vendor", "client").title, "Waiting for the vendor to confirm");
});

test("autoReleaseLine names the auto-release date for the client viewer", () => {
  assert.match(autoReleaseLine("2026-07-20T00:00:00Z", "client"), /pay your vendor automatically on/);
  assert.match(autoReleaseLine("garbage", "client"), /automatically on soon/);
});

test("the completion banner waits for the event day to pass, then asks the client if they still owe a confirmation", () => {
  const paid = { booking_status: "accepted", payment_status: "paid", event_date: "2020-01-01" };
  assert.deepEqual(completionBannerState({ ...paid, completion_waiting_on: "both" }), {
    waitingOn: "both",
    clientNeedsToConfirm: true,
  });
  assert.deepEqual(completionBannerState({ ...paid, completion_waiting_on: "vendor" }), {
    waitingOn: "vendor",
    clientNeedsToConfirm: false,
  });
  assert.equal(completionBannerState({ ...paid, event_date: "2999-01-01", completion_waiting_on: "client" }), null);
  assert.equal(completionBannerState({ ...paid, payment_status: "unpaid", completion_waiting_on: "client" }), null);
  assert.equal(completionBannerState({ ...paid, completion_waiting_on: null }), null);
});
