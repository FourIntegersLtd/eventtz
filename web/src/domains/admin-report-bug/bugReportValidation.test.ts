import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBugReportMessage } from "@/domains/admin-report-bug/bugReportValidation";

test("validateBugReportMessage accepts a useful report", () => {
  assert.equal(validateBugReportMessage("The vendor directory table is blank after I change the date filter."), null);
});

test("validateBugReportMessage rejects a short message", () => {
  assert.match(validateBugReportMessage("too short") ?? "", /10 characters/i);
});
