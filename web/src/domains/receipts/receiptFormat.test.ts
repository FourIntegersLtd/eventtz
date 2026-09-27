import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receiptDocumentTitle } from "@/domains/receipts/receiptFormat";

describe("receiptDocumentTitle", () => {
  it("returns the baseline titles for each document type", () => {
    assert.equal(receiptDocumentTitle("client_payment_receipt"), "Payment receipt");
    assert.equal(receiptDocumentTitle("vendor_payment_record"), "Payment record");
    assert.equal(receiptDocumentTitle("vendor_payout_statement"), "Payout statement");
  });
});
