import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReceiptDate,
  formatReceiptMoneyFromGbp,
  formatReceiptMoneyFromPence,
  receiptStatusNote,
} from "@/domains/receipts/receiptFormat";

describe("receiptFormat", () => {
  it("formats pence and pounds as UK currency", () => {
    assert.equal(formatReceiptMoneyFromPence(123_450), "£1,234.50");
    assert.equal(formatReceiptMoneyFromGbp(1234.5), "£1,234.50");
  });

  it("formats an event date label", () => {
    assert.equal(formatReceiptDate("2026-07-12"), "Sun, 12 Jul 2026");
  });

  it("returns the refunded status note", () => {
    assert.equal(receiptStatusNote("refunded"), "This payment was refunded in full.");
    assert.equal(receiptStatusNote("paid"), null);
  });
});
