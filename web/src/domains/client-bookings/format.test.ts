import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingStatusLabel,
  clientInitiatorBadgeLabel,
  formatDateTime,
  formatEventDate,
  formatGbp,
  formatMoneyLabel,
  paymentStatusLabel,
} from "@/domains/client-bookings/format";

test("formatGbp formats to two decimals with a pound sign and negatives", () => {
  assert.equal(formatGbp(1234), "£1,234.00");
  assert.equal(formatGbp(49.5), "£49.50");
  assert.equal(formatGbp(-50), "-£50.00");
});

test("formatMoneyLabel uses 0–2 fraction digits", () => {
  assert.equal(formatMoneyLabel(630), "£630");
  assert.equal(formatMoneyLabel(615.5), "£615.5");
  assert.equal(formatMoneyLabel(49.5), "£49.5");
});

test("formatEventDate renders a weekday", () => {
  assert.equal(formatEventDate("2026-07-12"), "Sun, 12 Jul 2026");
  assert.equal(formatEventDate("2026-07-12T00:00:00"), "Sun, 12 Jul 2026");
  assert.equal(formatEventDate(null), "");
  assert.equal(formatEventDate("short"), "short");
});

test("formatDateTime falls back to a dash or the raw string, and formats a timestamp", () => {
  assert.equal(formatDateTime(null), "-");
  assert.equal(formatDateTime(undefined), "-");
  assert.equal(formatDateTime("not-a-date"), "not-a-date");
  assert.match(formatDateTime("2026-07-12T14:03:00"), /12 Jul 2026, \d{2}:\d{2}/);
});

test("bookingStatusLabel maps known statuses and falls back to the raw code", () => {
  assert.equal(bookingStatusLabel("pending"), "Pending");
  assert.equal(bookingStatusLabel("accepted"), "Accepted");
  assert.equal(bookingStatusLabel("declined"), "Declined");
  assert.equal(bookingStatusLabel("cancelled"), "Cancelled");
  assert.equal(bookingStatusLabel("completed"), "Completed");
  assert.equal(bookingStatusLabel("weird"), "weird");
});

test("paymentStatusLabel maps known statuses and falls back to the raw code", () => {
  assert.equal(paymentStatusLabel("paid"), "Paid");
  assert.equal(paymentStatusLabel("payout_released"), "Payout released");
  assert.equal(paymentStatusLabel("pending"), "Payment pending");
  assert.equal(paymentStatusLabel("unknown"), "unknown");
});

test("clientInitiatorBadgeLabel is 'Vendor quote' only for vendor-initiated requests", () => {
  assert.equal(clientInitiatorBadgeLabel("vendor"), "Vendor quote");
  assert.equal(clientInitiatorBadgeLabel("client"), null);
});
