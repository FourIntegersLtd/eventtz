import type {
  VendorBookingDetail,
  VendorBookingListItem,
} from "@/lib/vendorBookingsApi";
import type { BookingDetailViewModel, BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import {
  toBookingDetailViewModel,
  toBookingListRowViewModel,
} from "@/features/bookings/toBookingDetailViewModel";

export function toVendorBookingRowViewModel(row: VendorBookingListItem): BookingListRowViewModel {
  return toBookingListRowViewModel(row, {
    counterpartyLine: row.client_email ?? "Client",
    initiatorBadgeLabel: row.initiator === "vendor" ? "Your quote" : null,
    reviewLine: row.review
      ? `${row.review.rating}/5 — ${row.review.reviewer_display}`
      : null,
  });
}

export function toVendorBookingDetailViewModel(
  detail: VendorBookingDetail,
  onOpenChat: () => void,
): BookingDetailViewModel {
  return toBookingDetailViewModel(detail, {
    role: "vendor",
    counterpartyRoleLabel: "Client",
    counterpartyName: detail.client_email ?? "Client",
    notesLabel: "Notes from client",
    onOpenChat,
  });
}
