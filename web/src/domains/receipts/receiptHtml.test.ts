import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receiptHtmlPath } from "@/domains/receipts/receiptHtml";

describe("receiptHtmlPath", () => {
  it("builds same-origin html paths for all three document kinds", () => {
    const bookingId = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(
      receiptHtmlPath("client_payment_receipt", bookingId),
      `/api/v1/client/booking-requests/${bookingId}/receipt.html`,
    );
    assert.equal(
      receiptHtmlPath("vendor_payment_record", bookingId),
      `/api/v1/vendor/booking-requests/${bookingId}/payment-record.html`,
    );
    assert.equal(
      receiptHtmlPath("vendor_payout_statement", bookingId),
      `/api/v1/vendor/booking-requests/${bookingId}/payout-statement.html`,
    );
  });
});
