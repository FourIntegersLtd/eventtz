import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingStatusLabel,
  disputeStatusLabel,
  formatEventDate,
  formatGbp,
  initiatorLabel,
  paymentStatusLabel,
} from "@/domains/vendor-bookings/format";

test("formatGbp renders whole pounds with the currency symbol and thousands separator", () => {
  assert.equal(formatGbp(1234), "£1,234.00");
});

test("formatGbp keeps pence", () => {
  assert.equal(formatGbp(49.5), "£49.50");
});

test("formatGbp shows a discount as a negative amount with a leading minus", () => {
  assert.equal(formatGbp(-50), "-£50.00");
});

test("formatGbp renders zero without a sign", () => {
  assert.equal(formatGbp(0), "£0.00");
});

test("formatEventDate renders a short UK date", () => {
  assert.equal(formatEventDate("2026-06-12"), "12 Jun 2026");
});

test("formatEventDate falls back for a missing date", () => {
  assert.equal(formatEventDate(null), "Date to be confirmed");
  assert.equal(formatEventDate(undefined), "Date to be confirmed");
});

test("formatEventDate returns the raw string when it cannot be parsed", () => {
  assert.equal(formatEventDate("not-a-date"), "not-a-date");
});

test("bookingStatusLabel maps every known status", () => {
  assert.equal(bookingStatusLabel("pending"), "Pending");
  assert.equal(bookingStatusLabel("accepted"), "Accepted");
  assert.equal(bookingStatusLabel("declined"), "Declined");
  assert.equal(bookingStatusLabel("cancelled"), "Cancelled");
});

test("bookingStatusLabel falls back to the raw code for an unknown status", () => {
  assert.equal(bookingStatusLabel("archived"), "archived");
});

test("paymentStatusLabel maps every known status", () => {
  assert.equal(paymentStatusLabel("unpaid"), "Unpaid");
  assert.equal(paymentStatusLabel("paid"), "Paid");
  assert.equal(paymentStatusLabel("payout_released"), "Payout released");
});

test("initiatorLabel distinguishes a vendor's own quote from a client enquiry", () => {
  assert.equal(initiatorLabel("vendor"), "Your quote");
  assert.equal(initiatorLabel("client"), "Client enquiry");
});

test("disputeStatusLabel maps every known status", () => {
  assert.equal(disputeStatusLabel("open"), "Open");
  assert.equal(disputeStatusLabel("under_review"), "Under review");
  assert.equal(disputeStatusLabel("resolved"), "Resolved");
  assert.equal(disputeStatusLabel("closed"), "Closed");
});
