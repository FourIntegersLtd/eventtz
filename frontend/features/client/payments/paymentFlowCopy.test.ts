import { describe, expect, it } from "vitest";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";

describe("PAYMENT_FLOW_COPY", () => {
  it("exposes beforePay copy for the pay page", () => {
    expect(PAYMENT_FLOW_COPY.beforePay.length).toBeGreaterThan(10);
  });
});
