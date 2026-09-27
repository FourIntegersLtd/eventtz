import test from "node:test";
import assert from "node:assert/strict";
import { checkoutReturnBanner, checkoutSyncBody } from "@/domains/client-bookings/checkoutReturn";

const PAYMENT_SUCCESS =
  "Thank you, your payment is received. We are holding it safely until your event is complete. After your event, please confirm everything went well so your vendor can be paid. If anything was not right, you have 48 hours to report a problem and we will help.";

test("a cancelled return is an amber banner and does not mention success", () => {
  assert.deepEqual(checkoutReturnBanner({ paymentParam: "cancelled", paymentStatus: "unpaid", syncError: null }), {
    show: true,
    tone: "amber",
    message: "Payment cancelled. Try again when you're ready.",
  });
});

test("a successful return of a confirmed payment shows the thank-you message", () => {
  assert.deepEqual(checkoutReturnBanner({ paymentParam: "success", paymentStatus: "paid", syncError: null }), {
    show: true,
    tone: "green",
    message: PAYMENT_SUCCESS,
  });
  assert.equal(
    checkoutReturnBanner({ paymentParam: "success", paymentStatus: "payout_released", syncError: null }).message,
    PAYMENT_SUCCESS,
  );
});

test("a successful return that is not confirmed yet shows the confirming message", () => {
  assert.deepEqual(checkoutReturnBanner({ paymentParam: "success", paymentStatus: "pending", syncError: null }), {
    show: true,
    tone: "green",
    message: "Confirming your payment…",
  });
});

test("a sync failure on a successful return is a red banner with that error", () => {
  assert.deepEqual(
    checkoutReturnBanner({
      paymentParam: "success",
      paymentStatus: "pending",
      syncError: "Payment went through. Refresh in a moment if it doesn't update.",
    }),
    {
      show: true,
      tone: "red",
      message: "Payment went through. Refresh in a moment if it doesn't update.",
    },
  );
});

test("no payment param hides the banner", () => {
  assert.deepEqual(checkoutReturnBanner({ paymentParam: null, paymentStatus: "paid", syncError: null }), {
    show: false,
    tone: "green",
    message: "",
  });
});

test("checkoutSyncBody sends the session id when Stripe provided one, otherwise an empty body", () => {
  assert.deepEqual(checkoutSyncBody("cs_123"), { session_id: "cs_123" });
  assert.deepEqual(checkoutSyncBody(null), {});
  assert.deepEqual(checkoutSyncBody(""), {});
});
