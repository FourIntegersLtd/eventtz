import api from "@/lib/axios";
import type { BookingTermsFields } from "@/lib/bookingTermsFields";
import type {
  BookingInitiator,
  BookingLineItem,
  BookingPricingBreakdown,
  ConfirmCompletionResponse,
  ParticipantBookingsListGroup,
  VendorAdjustmentItem,
} from "@/lib/domain-types";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type {
  BookingInitiator,
  BookingLineItem as VendorBookingLineItem,
  BookingPricingBreakdown,
  ConfirmCompletionResponse,
  ParticipantBookingsListGroup,
  VendorAdjustmentItem,
};

/** List filter: active = pending+accepted, closed = declined+cancelled */
export type VendorBookingsListGroup = ParticipantBookingsListGroup;

/** Client-authored review (shown to vendor after the booking is completed). */
export type VendorReviewSummary = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  reviewer_display: string;
  image_urls?: string[];
};

export type VendorBookingListItem = {
  booking_request_id: string;
  booking_status: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  total_label: string;
  client_email: string | null;
  /** Friendly client name (preferred name or derived) - safe to show pre-payment. */
  client_display_name: string | null;
  created_at: string | null;
  updated_at?: string | null;
  /** Full amount incl. vendor additions + Eventtz fee (when quote is all priced). */
  client_total_label: string | null;
  review: VendorReviewSummary | null;
  initiator?: BookingInitiator;
  conversation_id: string | null;
  payment_status: string;
  has_price_update?: boolean;
  /** Who still needs to confirm the event went well (accepted + paid bookings). */
  completion_waiting_on?: "client" | "vendor" | "both" | null;
  vendor_completion_confirmed_at?: string | null;
  event_id?: string | null;
  event_title?: string | null;
};

export type VendorBookingsListResponse = {
  success: boolean;
  bookings: VendorBookingListItem[];
  total?: number;
  offset?: number;
  limit?: number;
};

export type VendorBookingsPage = {
  bookings: VendorBookingListItem[];
  total: number;
  offset: number;
  limit: number;
};

export const VENDOR_BOOKINGS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export type VendorBookingDetail = BookingTermsFields & {
  booking_request_id: string;
  booking_status: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  event_postcode: string | null;
  event_address: string | null;
  notes: string | null;
  total_label: string;
  selected_option_ids: string[];
  line_items: BookingLineItem[];
  vendor_adjustments: VendorAdjustmentItem[];
  pricing: BookingPricingBreakdown | null;
  client_user_id: string | null;
  client_email: string | null;
  /** Friendly client name (preferred name or derived) - safe to show pre-payment. */
  client_display_name: string | null;
  created_at: string | null;
  /** Set automatically when payment succeeds (e.g. Stripe webhook). */
  paid_at: string | null;
  /** Money lifecycle, independent of `booking_status`: unpaid/pending/paid/refunded/partially_refunded/payout_released. */
  payment_status: string;
  /** True while a problem report is open or under review: completion cannot be confirmed. */
  has_open_dispute?: boolean;
  client_completion_confirmed_at: string | null;
  vendor_completion_confirmed_at: string | null;
  /** When the vendor payout releases automatically (48h after the event) if no one confirms. */
  payout_auto_release_at?: string | null;
  /** Who still needs to confirm the event went well. */
  completion_waiting_on?: "client" | "vendor" | "both" | null;
  review: VendorReviewSummary | null;
  initiator?: BookingInitiator;
  /** The client declined a new price; the booking is open again at the original price. */
  price_update_declined?: boolean;
  /** The client declined this vendor's date-change request; the original date stands. */
  date_change_declined?: boolean;
  counterparty_phone?: string | null;
  conversation_id: string | null;
  /** Client-facing total at request time (before vendor price changes). */
  initial_client_total_label?: string | null;
  cancellation_policy?: string | null;
  cancellation_refund_percent?: number | null;
  /** Vendor's share of a cancelled paid booking (GBP). */
  cancellation_vendor_share_gbp?: number | null;
  /** When that share was sent; null means held until Stripe payout setup is complete. */
  cancellation_payout_at?: string | null;
};

export type VendorBookingDetailResponse = {
  success: boolean;
  booking: VendorBookingDetail;
};

export type VendorBookingStatusResponse = {
  success: boolean;
  booking_request_id: string;
  booking_status: string;
};

export type VendorBookingsListParams = {
  group?: VendorBookingsListGroup | "all";
  status?: string;
  payment_status?: string;
  exclude_payment_status?: string;
  q?: string;
  conversation_id?: string;
};

export type VendorBookingsListParamsWithPage = VendorBookingsListParams & {
  offset?: number;
  limit?: number;
};

export async function fetchVendorBookingsPage(
  groupOrParams: VendorBookingsListGroup | "all" | VendorBookingsListParamsWithPage = "active",
): Promise<VendorBookingsPage> {
  const params: VendorBookingsListParamsWithPage =
    typeof groupOrParams === "string" ? { group: groupOrParams } : groupOrParams;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? VENDOR_BOOKINGS_PAGE_SIZE;
  const { data } = await api.get<VendorBookingsListResponse>(
    "/api/v1/vendor/booking-requests",
    {
      params: {
        group: params.group ?? "active",
        offset,
        limit,
        ...(params.status ? { status: params.status } : {}),
        ...(params.payment_status ? { payment_status: params.payment_status } : {}),
        ...(params.exclude_payment_status
          ? { exclude_payment_status: params.exclude_payment_status }
          : {}),
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.conversation_id ? { conversation_id: params.conversation_id } : {}),
      },
    },
  );
  return {
    bookings: data.bookings ?? [],
    total: data.total ?? data.bookings?.length ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

/** @deprecated Prefer paginated `fetchVendorBookingsPage` or portal dashboard APIs. */
export async function fetchVendorBookings(
  groupOrParams: VendorBookingsListGroup | "all" | VendorBookingsListParamsWithPage = "active",
): Promise<VendorBookingListItem[]> {
  const page = await fetchVendorBookingsPage({
    ...(typeof groupOrParams === "string" ? { group: groupOrParams } : groupOrParams),
    offset: 0,
    limit: 200,
  });
  return page.bookings;
}

export async function patchVendorBookingStatus(
  bookingId: string,
  bookingStatus: "accepted" | "declined" | "cancelled",
): Promise<VendorBookingStatusResponse> {
  const { data } = await api.patch<VendorBookingStatusResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}/status`,
    { booking_status: bookingStatus },
  );
  return data;
}
/** Mutual-confirmation completion: once both parties confirm, payout releases automatically. */
export async function postVendorConfirmCompletion(
  bookingId: string,
): Promise<ConfirmCompletionResponse> {
  const { data } = await api.post<ConfirmCompletionResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}/confirm-completion`,
  );
  return data;
}

export type PostVendorQuoteBody = {
  client_user_id: string;
  conversation_id?: string | null;
  event_name: string;
  event_date: string;
  event_end_date?: string | null;
  notes?: string | null;
  line_items: {
    id: string;
    heading: string;
    unit_price_gbp: number | null;
  }[];
};

export async function postVendorQuote(
  body: PostVendorQuoteBody,
): Promise<{ booking_request_id: string; booking_status: string; created_at: string | null }> {
  const { data } = await api.post<{
    success: boolean;
    booking_request_id: string;
    booking_status: string;
    created_at: string | null;
  }>("/api/v1/vendor/booking-requests/vendor-quote", body);
  return {
    booking_request_id: data.booking_request_id,
    booking_status: data.booking_status,
    created_at: data.created_at ?? null,
  };
}

export async function fetchVendorBookingDetail(
  bookingId: string,
): Promise<VendorBookingDetail> {
  const { data } = await api.get<VendorBookingDetailResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}`,
  );
  return data.booking;
}

export type VendorAdjustmentInput = {
  adjustment_category: string;
  label: string;
  amount_gbp: number;
};

export async function putVendorBookingAdjustments(
  bookingId: string,
  adjustments: VendorAdjustmentInput[],
): Promise<VendorBookingDetail> {
  const { data } = await api.put<{ success: boolean; booking: VendorBookingDetail }>(
    `/api/v1/vendor/booking-requests/${bookingId}/adjustments`,
    { adjustments },
  );
  return data.booking;
}

/** Vendor asks to keep part of the client's damage deposit. */
export async function postVendorDepositClaim(
  bookingId: string,
  body: { amount_gbp: number; note: string },
): Promise<void> {
  await api.post(`/api/v1/vendor/booking-requests/${bookingId}/deposit-claim`, body);
}
