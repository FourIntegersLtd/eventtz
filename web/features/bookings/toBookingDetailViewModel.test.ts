import { describe, expect, it } from "vitest";
import { toBookingDetailViewModel } from "@/features/bookings/toBookingDetailViewModel";
import type { BookingPricing } from "@/lib/domain-types";

describe("toBookingDetailViewModel", () => {
  it("uses initial client total as compare label when vendor adjustments exist", () => {
    const pricing: BookingPricing = {
      line_items_subtotal_gbp: 600,
      vendor_adjustments: [],
      adjustments_total_gbp: 0,
      vendor_portion_gbp: 600,
      service_fee_percent: 5,
      service_fee_gbp: 30,
      client_total_gbp: 630,
      has_pricing_tbc: false,
      vendor_portion_label: "GBP 600.00",
      service_fee_label: "GBP 30.00",
      client_total_label: "GBP 630.00",
      line_items_subtotal_label: "GBP 600.00",
    };

    const viewModel = toBookingDetailViewModel(
      {
        booking_request_id: "booking-1",
        event_name: "Garden party",
        booking_status: "pending",
        initiator: "client",
        created_at: "2026-01-01T12:00:00Z",
        event_date: "2026-09-01",
        event_end_date: null,
        event_postcode: null,
        event_address: null,
        notes: null,
        total_label: "GBP 630.00",
        pricing,
        line_items: [],
        paid_at: null,
        payment_status: "unpaid",
        conversation_id: null,
        initial_client_total_label: "GBP 600.00",
        vendor_adjustments: [{ id: "adj-1" }],
      },
      {
        role: "client",
        counterpartyRoleLabel: "Vendor",
        counterpartyName: "Ace Catering",
        notesLabel: "Your note",
        onOpenChat: () => {},
      },
    );

    expect(viewModel.compareTotalLabel).toBe("GBP 600.00");
  });
});
