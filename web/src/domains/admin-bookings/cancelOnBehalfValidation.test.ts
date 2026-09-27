import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCancelOnBehalfReason } from "@/domains/admin-bookings/cancelOnBehalfValidation";

test("validateCancelOnBehalfReason enforces length", () => {
  assert.equal(validateCancelOnBehalfReason("no"), "Enter a short reason (at least 3 characters).");
  assert.equal(validateCancelOnBehalfReason("Client asked to cancel"), null);
});
