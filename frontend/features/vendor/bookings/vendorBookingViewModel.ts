import type {
  VendorBookingDetail,
  VendorBookingListItem,
} from "@/lib/vendorBookingsApi";
import { formatDateTime, formatEventDate } from "@/lib/dateFormat";
import type {
  BookingDetailViewModel,
  BookingListRowViewModel,
} from "@/features/bookings/bookingViewModel";

export function toVendorBookingRowViewModel(row: VendorBookingListItem): BookingListRowViewModel {
  return {
    id: row.id,
    eventName: row.event_name,
    status: row.status,
    dateLabel: formatEventDate(row.event_date),
    totalLabel: row.client_total_label ?? row.total_label,
    counterpartyLine: row.client_email ?? "—",
    initiatorBadgeLabel: row.initiator === "vendor" ? "Your quote" : null,
    reviewLine: row.review
      ? `${row.review.rating}/5 — ${row.review.reviewer_display}`
      : null,
  };
}

export function toVendorBookingDetailViewModel(
  detail: VendorBookingDetail,
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
    counterpartyRoleLabel: "Client",
    counterpartyName: detail.client_email ?? "—",
    counterpartyPhone: detail.counterparty_phone ?? null,
    conversationId: detail.conversation_id,
    onOpenChat,
    notesLabel: "Notes from client",
    notes: detail.notes,
    totalLabel: detail.total_label,
    pricing: detail.pricing,
    lineItems: detail.line_items,
    pricingVariant: "vendor",
    portal: "vendor",
    paidAtLabel: detail.paid_at ? formatDateTime(detail.paid_at) : null,
    paymentStatus: detail.payment_status !== "unpaid" ? detail.payment_status : null,
  };
}
