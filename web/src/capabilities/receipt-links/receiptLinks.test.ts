import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPaymentReceipt, receiptViewHref } from "@/capabilities/receipt-links/receiptLinks";

describe("receiptLinks", () => {
  it("hasPaymentReceipt matches the baseline eligible statuses", () => {
    assert.equal(hasPaymentReceipt("paid"), true);
    assert.equal(hasPaymentReceipt("payout_released"), true);
    assert.equal(hasPaymentReceipt("refunded"), true);
    assert.equal(hasPaymentReceipt("partially_refunded"), true);
    assert.equal(hasPaymentReceipt("unpaid"), false);
    assert.equal(hasPaymentReceipt(null), false);
  });

  it("receiptViewHref returns the baseline portal paths", () => {
    const bookingId = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(receiptViewHref("client_payment_receipt", bookingId), `/client/bookings/${bookingId}/receipt`);
    assert.equal(
      receiptViewHref("vendor_payment_record", bookingId),
      `/vendor/bookings/${bookingId}/payment-record`,
    );
    assert.equal(
      receiptViewHref("vendor_payout_statement", bookingId),
      `/vendor/bookings/${bookingId}/payout-statement`,
    );
  });
});
