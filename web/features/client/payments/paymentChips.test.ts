import { describe, expect, it } from "vitest";
import { clientPaymentsListParams, PAYMENT_CHIP_STATUSES } from "@/features/client/payments/paymentChips";
import { CLIENT_BOOKINGS_PAGE_SIZE } from "@/lib/clientBookingsApi";

describe("clientPaymentsListParams", () => {
  it("sends no status set for the all chip and always hides unpaid enquiries", () => {
    expect(clientPaymentsListParams("all", 0)).toEqual({
      group: "all",
      exclude_payment_status: "unpaid",
      offset: 0,
      limit: CLIENT_BOOKINGS_PAGE_SIZE,
    });
  });

  it("maps each chip to the server's comma-separated payment_status set", () => {
    expect(clientPaymentsListParams("paid", 0).payment_status).toBe("paid,payout_released");
    expect(clientPaymentsListParams("refunds", 0).payment_status).toBe("refunded,partially_refunded");
    expect(clientPaymentsListParams("failed", 0).payment_status).toBe("unpaid,pending");
  });

  it("passes the page offset through", () => {
    expect(clientPaymentsListParams("paid", CLIENT_BOOKINGS_PAGE_SIZE).offset).toBe(CLIENT_BOOKINGS_PAGE_SIZE);
  });

  it("only names statuses the api accepts", () => {
    const known = ["unpaid", "pending", "paid", "payout_released", "refunded", "partially_refunded"];
    for (const statuses of Object.values(PAYMENT_CHIP_STATUSES)) {
      for (const status of statuses) expect(known).toContain(status);
    }
  });
});
