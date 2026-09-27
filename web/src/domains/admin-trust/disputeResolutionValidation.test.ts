import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDisputeFinancialResolution } from "@/domains/admin-trust/disputeResolutionValidation";

test("validateDisputeFinancialResolution requires an action", () => {
  const result = validateDisputeFinancialResolution("", "", "");
  assert.deepEqual(result, { error: "Choose a resolution action." });
});

test("validateDisputeFinancialResolution parses formatted partial-refund amounts", () => {
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "£50", ""), { refundAmountGbp: 50 });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "1,200.50", ""), {
    refundAmountGbp: 1200.5,
  });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", " 10 ", ""), { refundAmountGbp: 10 });
});

test("validateDisputeFinancialResolution rejects invalid partial-refund amounts", () => {
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "", ""), { error: "Enter an amount." });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "abc", ""), {
    error: "Enter a valid amount in pounds (£).",
  });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "-5", ""), {
    error: "Amount can't be negative.",
  });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "0", ""), {
    error: "Enter a refund amount greater than zero.",
  });
  assert.deepEqual(validateDisputeFinancialResolution("partial_refund", "1000001", ""), {
    error: "That amount is too high.",
  });
});

test("validateDisputeFinancialResolution limits the resolution note length", () => {
  const longNote = "x".repeat(8001);
  assert.deepEqual(validateDisputeFinancialResolution("refund_client", "", longNote), {
    error: "Message is too long.",
  });
});

test("validateDisputeFinancialResolution allows release without an amount", () => {
  assert.deepEqual(validateDisputeFinancialResolution("release_to_vendor", "", ""), { refundAmountGbp: null });
});
