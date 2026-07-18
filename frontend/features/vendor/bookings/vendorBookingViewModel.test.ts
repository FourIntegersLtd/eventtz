import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/markets";
import { toVendorBookingRowViewModel } from "@/features/vendor/bookings/vendorBookingViewModel";
import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";

describe("formatMoney", () => {
  it("formats GBP amounts", () => {
    const label = formatMoney(120, "GBP");
    expect(label).toMatch(/120/);
    expect(label.toUpperCase()).toMatch(/£|GBP/);
  });
});

describe("toVendorBookingRowViewModel", () => {
  it("maps counterparty and initiator badge", () => {
    const row = {
      id: "b1",
      status: "pending",
      payment_status: "unpaid",
      event_name: "Wedding",
      event_date: "2026-08-01",
      client_display_name: "Ada",
      client_email: "ada@example.com",
      initiator: "vendor",
      total_label: "GBP 100",
    } as VendorBookingListItem;

    const vm = toVendorBookingRowViewModel(row);
    expect(vm.counterpartyLine).toBe("Ada");
    expect(vm.initiatorBadgeLabel).toBe("Your quote");
  });
});
