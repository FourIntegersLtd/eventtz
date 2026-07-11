import type {
  ClientBookingDetail,
  ClientBookingListItem,
} from "@/lib/clientBookingsApi";
import { formatDateTime, formatEventDate } from "@/lib/dateFormat";
import type {
  BookingDetailViewModel,
  BookingListRowViewModel,
} from "@/features/bookings/bookingViewModel";

export function toClientBookingRowViewModel(row: ClientBookingListItem): BookingListRowViewModel {
  return {
    id: row.id,
    eventName: row.event_name,
    status: row.status,
    dateLabel: formatEventDate(row.event_date),
    totalLabel: row.client_total_label ?? row.total_label,
    counterpartyLine: row.vendor_display_name,
    initiatorBadgeLabel: row.initiator === "vendor" ? "Vendor quote" : null,
  };
}

export function toClientBookingDetailViewModel(
  detail: ClientBookingDetail,
  onOpenChat: () => void,
): BookingDetailViewModel {
  return {
    id: detail.id,
    eventName: detail.event_name,
    status: detail.status,
    timelineLabel: `${detail.initiator === "vendor" ? "Sent" : "Requested"} ${formatDateTime(detail.created_at)}`,
    isVendorInitiated: detail.initiator === "vendor",
    eventDateLabel: formatEventDate(detail.event_date),
    eventEndDateLabel: detail.event_end_date ? formatEventDate(detail.event_end_date) : null,
    venuePostcode: detail.event_postcode,
    venueAddress: detail.event_address,
    counterpartyRoleLabel: "Vendor",
    counterpartyName: detail.vendor_display_name,
    counterpartyPhone: detail.counterparty_phone ?? null,
    counterpartyHref: `/client/browse/${detail.vendor_user_id}`,
    conversationId: detail.conversation_id,
    onOpenChat,
    notesLabel: "Your notes",
    notes: detail.notes,
    totalLabel: detail.total_label,
    pricing: detail.pricing,
    lineItems: detail.line_items,
    pricingVariant: "client",
    portal: "client",
    paidAtLabel: detail.paid_at ? formatDateTime(detail.paid_at) : null,
    paymentStatus: detail.payment_status !== "unpaid" ? detail.payment_status : null,
  };
}
