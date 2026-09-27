import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAuditActionLabel } from "@/domains/admin-audit/auditFormatters";

test("formatAuditActionLabel maps known action codes to their baseline copy", () => {
  assert.equal(formatAuditActionLabel("booking.payment_fields.patch"), "Edited payment fields");
  assert.equal(formatAuditActionLabel("financials.export_csv"), "Exported financials report");
  assert.equal(formatAuditActionLabel("vendor.approval"), "Changed vendor approval");
});

test("formatAuditActionLabel humanizes an unknown action code instead of failing", () => {
  assert.equal(formatAuditActionLabel("something.new_thing"), "Something new thing");
});
