import type {
  ClientBookingDetail,
  ClientBookingListItem,
} from "@/lib/clientBookingsApi";
import type { BookingDetailViewModel, BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import {
  toBookingDetailViewModel,
  toBookingListRowViewModel,
} from "@/features/bookings/toBookingDetailViewModel";

export function toClientBookingRowViewModel(row: ClientBookingListItem): BookingListRowViewModel {
  return toBookingListRowViewModel(row, {
    counterpartyLine: row.vendor_display_name,
    initiatorBadgeLabel: row.initiator === "vendor" ? "Vendor quote" : null,
    portal: "client",
  });
}

export function toClientBookingDetailViewModel(
  detail: ClientBookingDetail,
  onOpenChat: () => void,
): BookingDetailViewModel {
  return toBookingDetailViewModel(detail, {
    role: "client",
    counterpartyRoleLabel: "Vendor",
    counterpartyName: detail.vendor_display_name,
    counterpartyHref: `/client/browse/${detail.vendor_user_id}`,
    notesLabel: "Your notes",
    onOpenChat,
  });
}
