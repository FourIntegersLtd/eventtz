import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filenameFromContentDisposition, receiptHtmlPath } from "@/domains/receipts/receiptDownload";

describe("receiptDownload", () => {
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

  it("parses a filename from Content-Disposition", () => {
    assert.equal(
      filenameFromContentDisposition('attachment; filename="receipt-EVT-550E8400.html"'),
      "receipt-EVT-550E8400.html",
    );
  });
});
