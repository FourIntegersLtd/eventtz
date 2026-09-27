import test from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_FLOW_COPY, PAYMENT_SAFETY_COPY } from "@/domains/client-bookings/bookingCopy";

test("PAYMENT_FLOW_COPY checkout-return strings match the baseline", () => {
  assert.equal(
    PAYMENT_FLOW_COPY.paymentSuccess,
    "Thank you, your payment is received. We are holding it safely until your event is complete. After your event, please confirm everything went well so your vendor can be paid. If anything was not right, you have 48 hours to report a problem and we will help.",
  );
  assert.equal(PAYMENT_FLOW_COPY.paymentCancelledReturn, "Payment cancelled. Try again when you're ready.");
  assert.equal(PAYMENT_FLOW_COPY.paymentConfirming, "Confirming your payment…");
  assert.equal(
    PAYMENT_FLOW_COPY.paymentSyncPending,
    "Payment went through. Refresh in a moment if it doesn't update.",
  );
  assert.equal(
    PAYMENT_FLOW_COPY.payNotReady,
    "This booking isn't ready for payment. Go back to the booking for the current status.",
  );
});

test("PAYMENT_SAFETY_COPY explains fund protection and the 48-hour window", () => {
  assert.equal(PAYMENT_SAFETY_COPY.points.length, 4);
  const joined = PAYMENT_SAFETY_COPY.points.join(" ");
  assert.equal(joined.includes("48 hours"), true);
  assert.equal(joined.includes("safely"), true);
});
