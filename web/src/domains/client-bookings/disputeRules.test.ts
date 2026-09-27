import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canOfferOpenDispute,
  canOpenDisputeForBookingStatus,
  DISPUTE_POLL_MS,
  disputeOpenedAtLabel,
  disputeResolutionPrefix,
  disputeStatusBadgeClass,
  disputeStatusLabel,
} from "@/domains/client-bookings/disputeRules";

test("canOpenDisputeForBookingStatus allows pending, accepted, and completed only", () => {
  assert.equal(canOpenDisputeForBookingStatus("pending"), true);
  assert.equal(canOpenDisputeForBookingStatus("accepted"), true);
  assert.equal(canOpenDisputeForBookingStatus("completed"), true);
  assert.equal(canOpenDisputeForBookingStatus("cancelled"), false);
  assert.equal(canOpenDisputeForBookingStatus("declined"), false);
  assert.equal(canOpenDisputeForBookingStatus(""), false);
});

test("canOfferOpenDispute is false while a dispute is open or under review", () => {
  assert.equal(canOfferOpenDispute("accepted", []), true);
  assert.equal(canOfferOpenDispute("accepted", ["resolved", "closed"]), true);
  assert.equal(canOfferOpenDispute("accepted", ["open"]), false);
  assert.equal(canOfferOpenDispute("completed", ["under_review"]), false);
  assert.equal(canOfferOpenDispute("cancelled", []), false);
  assert.equal(canOfferOpenDispute("declined", ["resolved"]), false);
});

test("disputeStatusLabel and badge class match the baseline", () => {
  assert.equal(disputeStatusLabel("open"), "Open");
  assert.equal(disputeStatusLabel("under_review"), "Under review");
  assert.equal(disputeStatusLabel("resolved"), "Resolved");
  assert.equal(disputeStatusLabel("closed"), "Closed");
  assert.equal(disputeStatusLabel("archived"), "archived");
  assert.equal(disputeStatusBadgeClass("open"), "bg-amber-100 text-amber-900");
  assert.equal(disputeStatusBadgeClass("under_review"), "bg-sky-100 text-sky-900");
  assert.equal(disputeStatusBadgeClass("resolved"), "bg-emerald-100 text-emerald-900");
  assert.equal(disputeStatusBadgeClass("closed"), "bg-neutral-200 text-neutral-700");
  assert.equal(disputeStatusBadgeClass("archived"), "bg-neutral-100 text-neutral-700");
});

test("disputeResolutionPrefix says Outcome once the case is finished", () => {
  assert.equal(disputeResolutionPrefix("resolved"), "Outcome: ");
  assert.equal(disputeResolutionPrefix("closed"), "Outcome: ");
  assert.equal(disputeResolutionPrefix("open"), "Update: ");
  assert.equal(disputeResolutionPrefix("under_review"), "Update: ");
});

test("disputeOpenedAtLabel is blank when there is no timestamp", () => {
  assert.equal(disputeOpenedAtLabel(null), "");
  assert.equal(disputeOpenedAtLabel("not-a-date"), "not-a-date");
});

test("the booking page re-reads disputes every 50 seconds", () => {
  assert.equal(DISPUTE_POLL_MS, 50000);
});
