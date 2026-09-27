/**
 * Row and detail view models for the client bookings domain, ported from the
 * baseline's `clientBookingViewModel.ts` and the shared
 * `toBookingDetailViewModel.ts` / `bookingPendingLabels.ts` (client half).
 * Pure and testable; the components render from these.
 */
import type { ClientBookingDetail, ClientBookingListItem, BookingPricingBreakdown } from "@/domains/client-bookings/api";
import type { DisplayLineItem } from "@/domains/client-bookings/lineItems";
import { toDisplayLineItem } from "@/domains/client-bookings/lineItems";
import { clientTotalBeforeVendorAdjustments } from "@/domains/client-bookings/priceLabels";
import { formatDateTime, formatEventDate } from "@/domains/client-bookings/format";

/** One row of the client's bookings list, ready to render. */
export type ClientBookingRowViewModel = {
  id: string;
  eventName: string;
  status: string;
  dateLabel: string;
  totalLabel: string;
  counterpartyLine: string;
  initiatorBadgeLabel: string | null;
  pendingSubtext: string | null;
  hasPriceUpdate: boolean;
  paymentStatus: string;
};

type PendingLabelInput = {
  status: string;
  initiator: "client" | "vendor";
  hasPriceUpdate?: boolean;
};

/** Role-aware subtext shown under the pending badge in a client list row. */
export function bookingListPendingSubtext(row: PendingLabelInput): string | null {
  if (row.status !== "pending") return null;
  if (row.initiator === "vendor") return null;
  if (row.hasPriceUpdate) return "New price. Your response needed";
  return "Waiting for vendor - most reply within a day";
}

/** Maps a list row to the client reshaped view model. */
export function toClientBookingRowViewModel(row: ClientBookingListItem): ClientBookingRowViewModel {
  return {
    id: row.booking_request_id,
    eventName: row.event_name,
    status: row.booking_status,
    dateLabel: formatEventDate(row.event_date),
    totalLabel: row.client_total_label ?? row.total_label,
    counterpartyLine: row.vendor_display_name,
    initiatorBadgeLabel: row.initiator === "vendor" ? "Vendor quote" : null,
    pendingSubtext: bookingListPendingSubtext({
      status: row.booking_status,
      initiator: row.initiator,
      hasPriceUpdate: row.has_price_update,
    }),
    hasPriceUpdate: row.has_price_update,
    paymentStatus: row.payment_status,
  };
}

/** One booking's detail, ready to render. */
export type ClientBookingDetailViewModel = {
  id: string;
  eventName: string;
  status: string;
  timelineLabel: string;
  isVendorInitiated: boolean;
  eventDateLabel: string;
  eventEndDateLabel: string | null;
  venuePostcode: string | null;
  venueAddress: string | null;
  counterpartyName: string;
  counterpartyHref: string;
  counterpartyPhone: string | null;
  notesLabel: string;
  notes: string | null;
  totalLabel: string;
  pricing: BookingPricingBreakdown | null;
  lineItems: DisplayLineItem[];
  paidAtLabel: string | null;
  paymentStatus: string | null;
  compareTotalLabel: string | null;
};

/** Maps a booking detail to the client reshaped view model. */
export function toClientBookingDetailViewModel(
  detail: ClientBookingDetail,
  counterpartyName: string,
  counterpartyHref: string,
): ClientBookingDetailViewModel {
  const isVendorInitiated = detail.initiator === "vendor";
  const hasPriceUpdate = (detail.vendor_adjustments?.length ?? 0) > 0;
  const compareTotalLabel = hasPriceUpdate
    ? detail.initial_client_total_label?.trim() ||
      clientTotalBeforeVendorAdjustments(detail.pricing) ||
      null
    : null;

  return {
    id: detail.booking_request_id,
    eventName: detail.event_name,
    status: detail.booking_status,
    timelineLabel: `${isVendorInitiated ? "Sent" : "Requested"} ${formatDateTime(detail.created_at)}`,
    isVendorInitiated,
    eventDateLabel: formatEventDate(detail.event_date),
    eventEndDateLabel: detail.event_end_date ? formatEventDate(detail.event_end_date) : null,
    venuePostcode: detail.event_postcode ?? null,
    venueAddress: detail.event_address ?? null,
    counterpartyName,
    counterpartyHref,
    counterpartyPhone: detail.counterparty_phone ?? null,
    notesLabel: "Your notes",
    notes: detail.notes ?? null,
    totalLabel: detail.total_label,
    pricing: detail.pricing ?? null,
    lineItems: detail.line_items.map((raw, index) => toDisplayLineItem(raw, index)),
    paidAtLabel: detail.paid_at ? formatDateTime(detail.paid_at) : null,
    paymentStatus: detail.payment_status !== "unpaid" ? detail.payment_status : null,
    compareTotalLabel,
  };
}
