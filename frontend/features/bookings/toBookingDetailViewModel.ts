import { formatDateTime, formatEventDate } from "@/lib/dateFormat";
import type { BookingInitiator } from "@/lib/domain-types";
import type {
  BookingDetailViewModel,
  BookingListRowViewModel,
} from "@/features/bookings/bookingViewModel";
import type { BookingLineItemRow, BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import { clientTotalBeforeVendorAdjustments } from "@/lib/bookingPriceLabels";
import { bookingListPendingSubtext } from "@/features/bookings/bookingPendingLabels";

type ParticipantBookingDetailSource = {
  id: string;
  event_name: string;
  status: string;
  initiator?: BookingInitiator;
  created_at: string | null;
  event_date: string;
  event_end_date: string | null;
  event_postcode: string | null;
  event_address: string | null;
  notes: string | null;
  total_label: string;
  pricing: BookingPricing | null;
  line_items: BookingLineItemRow[];
  paid_at: string | null;
  payment_status: string;
  conversation_id: string | null;
  counterparty_phone?: string | null;
  initial_client_total_label?: string | null;
  vendor_adjustments?: { id: string }[];
};

type ParticipantBookingListSource = {
  id: string;
  event_name: string;
  status: string;
  event_date: string;
  total_label: string;
  client_total_label?: string | null;
  initiator?: BookingInitiator;
  has_price_update?: boolean;
  payment_status?: string;
};

type ToBookingDetailViewModelConfig = {
  role: "client" | "vendor";
  counterpartyRoleLabel: string;
  counterpartyName: string;
  counterpartyHref?: string;
  notesLabel: string;
  onOpenChat: () => void;
};

export function toBookingDetailViewModel(
  detail: ParticipantBookingDetailSource,
  config: ToBookingDetailViewModelConfig,
): BookingDetailViewModel {
  const isVendorInitiated = detail.initiator === "vendor";
  const hasPriceUpdate = (detail.vendor_adjustments?.length ?? 0) > 0;
  const compareTotalLabel =
    hasPriceUpdate
      ? detail.initial_client_total_label?.trim() ||
        clientTotalBeforeVendorAdjustments(detail.pricing) ||
        null
      : null;
  return {
    id: detail.id,
    eventName: detail.event_name,
    status: detail.status,
    timelineLabel: `${isVendorInitiated ? "Sent" : "Requested"} ${formatDateTime(detail.created_at)}`,
    isVendorInitiated,
    eventDateLabel: formatEventDate(detail.event_date),
    eventEndDateLabel: detail.event_end_date ? formatEventDate(detail.event_end_date) : null,
    venuePostcode: detail.event_postcode,
    venueAddress: detail.event_address,
    counterpartyRoleLabel: config.counterpartyRoleLabel,
    counterpartyName: config.counterpartyName,
    counterpartyPhone: detail.counterparty_phone ?? null,
    counterpartyHref: config.counterpartyHref,
    conversationId: detail.conversation_id,
    onOpenChat: config.onOpenChat,
    notesLabel: config.notesLabel,
    notes: detail.notes,
    totalLabel: detail.total_label,
    pricing: detail.pricing,
    lineItems: detail.line_items,
    pricingVariant: config.role,
    portal: config.role,
    paidAtLabel: detail.paid_at ? formatDateTime(detail.paid_at) : null,
    paymentStatus: detail.payment_status !== "unpaid" ? detail.payment_status : null,
    compareTotalLabel,
  };
}

export function toBookingListRowViewModel(
  row: ParticipantBookingListSource,
  config: {
    counterpartyLine: string;
    initiatorBadgeLabel?: string | null;
    reviewLine?: string | null;
    portal: "client" | "vendor";
  },
): BookingListRowViewModel {
  return {
    id: row.id,
    eventName: row.event_name,
    status: row.status,
    dateLabel: formatEventDate(row.event_date),
    totalLabel: row.client_total_label ?? row.total_label,
    counterpartyLine: config.counterpartyLine,
    initiatorBadgeLabel: config.initiatorBadgeLabel ?? null,
    reviewLine: config.reviewLine ?? null,
    pendingSubtext: bookingListPendingSubtext(config.portal, {
      status: row.status,
      initiator: row.initiator,
      hasPriceUpdate: row.has_price_update,
      paymentStatus: row.payment_status,
    }),
  };
}
