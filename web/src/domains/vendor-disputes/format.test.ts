import assert from "node:assert/strict";
import { test } from "node:test";
import { disputeStatusLabel, formatEventDate } from "@/domains/vendor-disputes/format";

test("disputeStatusLabel maps every known status", () => {
  assert.equal(disputeStatusLabel("open"), "Open");
  assert.equal(disputeStatusLabel("under_review"), "Under review");
  assert.equal(disputeStatusLabel("resolved"), "Resolved");
  assert.equal(disputeStatusLabel("closed"), "Closed");
});

test("disputeStatusLabel falls back to the raw code for an unknown status", () => {
  assert.equal(disputeStatusLabel("archived"), "archived");
});

test("formatEventDate renders a short UK date", () => {
  assert.equal(formatEventDate("2026-06-12"), "12 Jun 2026");
});

test("formatEventDate falls back for a missing date", () => {
  assert.equal(formatEventDate(null), "Date to be confirmed");
});
