import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISPUTE_ALREADY_OPEN_FALLBACK,
  DISPUTE_LOAD_FAILED,
  DISPUTE_OPENED_MESSAGE,
  DISPUTE_SUBMIT_FAILED,
  OPEN_DISPUTE_CONFIRM,
  parseDisputeSummary,
} from "@/domains/client-bookings/disputeSummary";

test("a summary under 10 characters is rejected with the baseline message", () => {
  const result = parseDisputeSummary({ summary: "123456789" });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.summary, "Please enter at least 10 characters.");
  assert.equal(result.formError, "Please enter at least 10 characters.");
});

test("whitespace is trimmed before the minimum length is checked", () => {
  const result = parseDisputeSummary({ summary: "   short   " });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.formError, "Please enter at least 10 characters.");
});

test("a summary over 4000 characters is rejected", () => {
  const result = parseDisputeSummary({ summary: "x".repeat(4001) });
  assert.equal(result.ok, false);
  if (result.ok) assert.fail();
  assert.equal(result.fieldErrors.summary, "Summary is too long.");
});

test("a valid summary is trimmed and returned", () => {
  const result = parseDisputeSummary({ summary: "  The vendor never arrived for the event.  " });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.equal(result.data.summary, "The vendor never arrived for the event.");
});

test("exactly 10 characters is accepted", () => {
  const result = parseDisputeSummary({ summary: "1234567890" });
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail();
  assert.equal(result.data.summary, "1234567890");
});

test("open-dispute confirm copy matches the baseline", () => {
  assert.equal(OPEN_DISPUTE_CONFIRM.title, "Report a problem?");
  assert.equal(
    OPEN_DISPUTE_CONFIRM.description,
    "Tell us what went wrong. We'll look into it and pause any payment to the vendor until it's resolved. Keep messages on Eventtz so we have a clear record.",
  );
  assert.equal(OPEN_DISPUTE_CONFIRM.cancelLabel, "Go back");
  assert.equal(OPEN_DISPUTE_CONFIRM.confirmLabel, "Submit report");
  assert.equal(OPEN_DISPUTE_CONFIRM.confirmLoadingLabel, "Submitting…");
});

test("dispute section fallback messages match the baseline", () => {
  assert.equal(DISPUTE_OPENED_MESSAGE, "Dispute opened");
  assert.equal(DISPUTE_LOAD_FAILED, "Could not load dispute status.");
  assert.equal(DISPUTE_SUBMIT_FAILED, "Could not submit dispute.");
  assert.equal(DISPUTE_ALREADY_OPEN_FALLBACK, "There is already an open dispute on this booking.");
});
