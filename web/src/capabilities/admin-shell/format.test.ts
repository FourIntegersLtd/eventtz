import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatGbp, humanize } from "@/capabilities/admin-shell/format";

test("formatDate renders a UK-style date and handles missing values", () => {
  assert.equal(formatDate("2026-09-26T10:00:00Z"), "26 Sep 2026");
  assert.equal(formatDate(null), "-");
  assert.equal(formatDate(undefined), "-");
  assert.equal(formatDate("not-a-date"), "-");
});

test("formatDateTime includes the time", () => {
  assert.equal(formatDateTime("2026-09-26T10:05:00Z"), "26 Sep 2026, 10:05");
  assert.equal(formatDateTime(null), "-");
});

test("formatGbp renders a currency string and handles missing values", () => {
  assert.equal(formatGbp(1234.5), "£1,234.50");
  assert.equal(formatGbp(0), "£0.00");
  assert.equal(formatGbp(null), "-");
  assert.equal(formatGbp(undefined), "-");
});

test("humanize turns a snake/kebab enum value into a capitalised label", () => {
  assert.equal(humanize("booking_request"), "Booking request");
  assert.equal(humanize("under-review"), "Under review");
  assert.equal(humanize(null), "-");
});
