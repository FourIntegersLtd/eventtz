import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDisputeFinancialResolution } from "@/domains/admin-trust/disputeResolutionValidation";

test("validateDisputeFinancialResolution requires an action", () => {
  assert.equal(validateDisputeFinancialResolution("", ""), "Choose a resolution action.");
});

test("validateDisputeFinancialResolution requires a positive partial refund", () => {
  assert.equal(validateDisputeFinancialResolution("partial_refund", "0"), "Enter a refund amount greater than zero.");
  assert.equal(validateDisputeFinancialResolution("partial_refund", "25.5"), null);
  assert.equal(validateDisputeFinancialResolution("refund_client", ""), null);
});
