import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISPUTE_DETAIL_LOAD_ERROR,
  DISPUTE_NOT_FOUND,
  DISPUTES_EMPTY_TITLE,
  DISPUTES_LIST_INTRO,
  DISPUTES_LOAD_ERROR,
  disputeBookingLabel,
  disputeDetailOpenedByLabel,
  disputeListOpenedByLabel,
  disputeStatusBadgeClass,
  disputeStatusLabel,
  disputesMostRecentlyOpened,
  disputeUpdatedLabel,
  formatDisputeDateTime,
  formatEventDate,
} from "@/domains/disputes/format";

test("disputeStatusLabel maps every known status", () => {
  assert.equal(disputeStatusLabel("open"), "Open");
  assert.equal(disputeStatusLabel("under_review"), "Under review");
  assert.equal(disputeStatusLabel("resolved"), "Resolved");
  assert.equal(disputeStatusLabel("closed"), "Closed");
});

test("disputeStatusLabel falls back to the raw code for an unknown status", () => {
  assert.equal(disputeStatusLabel("archived"), "archived");
});

test("disputeStatusBadgeClass uses the baseline colour for each status", () => {
  assert.equal(disputeStatusBadgeClass("open"), "bg-amber-100 text-amber-900");
  assert.equal(disputeStatusBadgeClass("under_review"), "bg-sky-100 text-sky-900");
  assert.equal(disputeStatusBadgeClass("resolved"), "bg-emerald-100 text-emerald-900");
  assert.equal(disputeStatusBadgeClass("closed"), "bg-neutral-200 text-neutral-700");
  assert.equal(disputeStatusBadgeClass("archived"), "bg-neutral-100 text-neutral-700");
});

test("formatEventDate renders a short UK date", () => {
  assert.equal(formatEventDate("2026-06-12"), "12 Jun 2026");
});

test("formatEventDate falls back for a missing date", () => {
  assert.equal(formatEventDate(null), "Date to be confirmed");
});

test("formatDisputeDateTime falls back for a missing or unparseable value", () => {
  assert.equal(formatDisputeDateTime(null), "-");
  assert.equal(formatDisputeDateTime("not-a-date"), "not-a-date");
});

test("formatDisputeDateTime renders a UK date and time", () => {
  assert.equal(formatDisputeDateTime("2026-06-12T12:00:00.000Z"), "12 Jun 2026, 13:00");
});

test("disputeBookingLabel joins the event name and date, or says Booking", () => {
  assert.equal(disputeBookingLabel({ event_name: "Summer wedding", event_date: "2026-06-12" }), "Summer wedding · 12 Jun 2026");
  assert.equal(disputeBookingLabel({ event_name: "Summer wedding", event_date: null }), "Summer wedding");
  assert.equal(disputeBookingLabel({ event_name: null, event_date: "2026-06-12" }), "Booking");
});

test("disputeListOpenedByLabel matches the list row wording", () => {
  assert.equal(disputeListOpenedByLabel({ opened_by_you: true }), "You");
  assert.equal(
    disputeListOpenedByLabel({ opened_by_you: false, opened_by_display_name: "Ada" }),
    "Ada",
  );
  assert.equal(
    disputeListOpenedByLabel({ opened_by_you: false, opened_by_role: "client" }),
    "Client",
  );
  assert.equal(
    disputeListOpenedByLabel({ opened_by_you: false, opened_by_role: "vendor", vendor_display_name: "Ada Catering" }),
    "Ada Catering",
  );
  assert.equal(
    disputeListOpenedByLabel({ opened_by_you: false, opened_by_role: "vendor", vendor_display_name: null }),
    "Vendor",
  );
  assert.equal(disputeListOpenedByLabel({ opened_by_you: false }), "-");
});

test("disputeDetailOpenedByLabel matches the detail panel wording", () => {
  assert.equal(disputeDetailOpenedByLabel({ opened_by_you: true, opened_by_display_name: "Ada" }), "You");
  assert.equal(
    disputeDetailOpenedByLabel({ opened_by_you: false, opened_by_display_name: "  Ada  " }),
    "Ada",
  );
  assert.equal(
    disputeDetailOpenedByLabel({ opened_by_you: false, opened_by_display_name: "   ", opened_by_role: "client" }),
    "The client",
  );
  assert.equal(
    disputeDetailOpenedByLabel({ opened_by_you: false, opened_by_role: "vendor" }),
    "The vendor",
  );
  assert.equal(disputeDetailOpenedByLabel({ opened_by_you: false }), "Someone on this booking");
});

test("disputeUpdatedLabel prefers updated_at, then created_at, then a dash", () => {
  assert.equal(disputeUpdatedLabel({ updated_at: null, created_at: null }), "-");
  assert.equal(
    disputeUpdatedLabel({ updated_at: "2026-06-12T12:00:00.000Z", created_at: "2026-01-01T12:00:00.000Z" }),
    "12 Jun 2026, 13:00",
  );
});

test("disputesMostRecentlyOpened puts the newest opened dispute first", () => {
  const ordered = disputesMostRecentlyOpened([
    { id: "older", created_at: "2026-01-01T00:00:00Z" },
    { id: "undated", created_at: null },
    { id: "newer", created_at: "2026-06-01T00:00:00Z" },
  ]);
  assert.deepEqual(
    ordered.map((dispute) => dispute.id),
    ["newer", "older", "undated"],
  );
});

test("list and detail fallback copy matches the baseline", () => {
  assert.equal(DISPUTES_LIST_INTRO, "Your disputes. Select one for details.");
  assert.equal(DISPUTES_EMPTY_TITLE, "No disputes yet.");
  assert.equal(DISPUTES_LOAD_ERROR, "Could not load disputes.");
  assert.equal(DISPUTE_DETAIL_LOAD_ERROR, "Could not load this dispute.");
  assert.equal(DISPUTE_NOT_FOUND, "Dispute not found.");
});
