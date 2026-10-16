import { describe, expect, it } from "vitest";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";

describe("PAYMENT_FLOW_COPY", () => {
  it("exposes beforePay copy for the pay page", () => {
    expect(PAYMENT_FLOW_COPY.beforePay.length).toBeGreaterThan(10);
  });

  it("centralises checkout-return and payment-due copy", () => {
    expect(PAYMENT_FLOW_COPY.paymentCancelledReturn.length).toBeGreaterThan(10);
    expect(PAYMENT_FLOW_COPY.paymentConfirming.length).toBeGreaterThan(5);
    expect(PAYMENT_FLOW_COPY.paymentSyncPending.length).toBeGreaterThan(10);
    expect(PAYMENT_FLOW_COPY.paymentDueTitle.length).toBeGreaterThan(3);
    expect(PAYMENT_FLOW_COPY.payNowLabel.length).toBeGreaterThan(2);
    expect(PAYMENT_FLOW_COPY.payNotReady.length).toBeGreaterThan(10);
  });
});
