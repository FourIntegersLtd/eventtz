import test from "node:test";
import assert from "node:assert/strict";
import type { ClientBookingDetail, ClientBookingListItem } from "@/domains/client-bookings/api";
import { bookingListPendingSubtext, toClientBookingDetailViewModel, toClientBookingRowViewModel } from "@/domains/client-bookings/viewModel";
import { bookingTabForStatus } from "@/domains/client-bookings/bookingCopy";

function listItem(overrides: Partial<ClientBookingListItem> = {}): ClientBookingListItem {
  return {
    booking_request_id: "b1",
    booking_status: "pending",
    event_name: "Wedding",
    event_date: "2026-07-12",
    has_price_update: false,
    has_review: false,
    initiator: "client",
    payment_status: "unpaid",
    total_label: "£630",
    vendor_display_name: "Amina's Catering",
    vendor_user_id: "v1",
    ...overrides,
  };
}

function detail(overrides: Partial<ClientBookingDetail> = {}): ClientBookingDetail {
  return {
    booking_request_id: "b1",
    booking_status: "accepted",
    event_name: "Wedding",
    event_date: "2026-07-12",
    initiator: "client",
    line_items: [],
    payment_status: "paid",
    selected_option_ids: [],
    total_label: "£630",
    vendor_display_name: "Amina's Catering",
    vendor_user_id: "v1",
    created_at: "2026-06-01T09:00:00Z",
    ...overrides,
  };
}

test("bookingTabForStatus buckets pending/accepted into active, the rest into closed", () => {
  assert.equal(bookingTabForStatus("pending"), "active");
  assert.equal(bookingTabForStatus("accepted"), "active");
  assert.equal(bookingTabForStatus("declined"), "closed");
  assert.equal(bookingTabForStatus("cancelled"), "closed");
  assert.equal(bookingTabForStatus("completed"), "closed");
});

test("bookingListPendingSubtext only speaks for a pending client-initiated request", () => {
  assert.equal(bookingListPendingSubtext({ status: "pending", initiator: "client" }), "Waiting for vendor - most reply within a day");
  assert.equal(
    bookingListPendingSubtext({ status: "pending", initiator: "client", hasPriceUpdate: true }),
    "New price. Your response needed",
  );
  assert.equal(bookingListPendingSubtext({ status: "pending", initiator: "vendor" }), null);
  assert.equal(bookingListPendingSubtext({ status: "accepted", initiator: "client" }), null);
});

test("toClientBookingRowViewModel uses the client total and marks vendor quotes", () => {
  const row = toClientBookingRowViewModel(listItem());
  assert.equal(row.totalLabel, "£630");
  assert.equal(row.counterpartyLine, "Amina's Catering");
  assert.equal(row.initiatorBadgeLabel, null);

  const quoteRow = toClientBookingRowViewModel(listItem({ initiator: "vendor", client_total_label: "£615" }));
  assert.equal(quoteRow.totalLabel, "£615");
  assert.equal(quoteRow.initiatorBadgeLabel, "Vendor quote");
  assert.equal(quoteRow.pendingSubtext, null);

  assert.equal(toClientBookingRowViewModel(listItem({ client_total_label: null })).totalLabel, "£630");
});

test("toClientBookingDetailViewModel builds the timeline and hides unpaid payment status", () => {
  const model = toClientBookingDetailViewModel(detail(), "Amina's Catering", "/client/browse/v1");
  assert.equal(model.timelineLabel.includes("Requested"), true);
  assert.equal(model.counterpartyName, "Amina's Catering");
  assert.equal(model.paymentStatus, "paid");
  assert.equal(model.notesLabel, "Your notes");

  const unpaid = toClientBookingDetailViewModel(detail({ payment_status: "unpaid" }), "Amina's Catering", "/client/browse/v1");
  assert.equal(unpaid.paymentStatus, null);
  assert.equal(unpaid.isVendorInitiated, false);
});

test("the detail model shows a compare total when the vendor updated the price", () => {
  const updated = toClientBookingDetailViewModel(
    detail({ initial_client_total_label: "£630", vendor_adjustments: [{ id: "a", label: "Extra", amount_gbp: 10, adjustment_category: "cost" }] }),
    "Amina's Catering",
    "/client/browse/v1",
  );
  assert.equal(updated.compareTotalLabel, "£630");
});
