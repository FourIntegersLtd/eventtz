import api from "@/lib/axios";
import type {
  BookingInitiator,
  BookingPricingBreakdown,
  VendorAdjustmentItem,
} from "@/lib/domain-types";

export type { BookingInitiator, BookingPricingBreakdown, VendorAdjustmentItem };

/** List filter: active = pending+accepted, closed = declined+cancelled */
export type VendorBookingsListGroup = "active" | "completed" | "closed";

/** Client-authored review (shown to vendor after the booking is completed). */
export type VendorReviewSummary = {
  id: string;
  rating: number;
  body: string;
  created_at: string | null;
  reviewer_display: string;
};

export type VendorBookingListItem = {
  id: string;
  status: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  total_label: string;
  client_email: string | null;
  created_at: string | null;
  /** Full amount incl. vendor additions + Eventtz fee (when quote is all priced). */
  client_total_label: string | null;
  review: VendorReviewSummary | null;
  initiator?: BookingInitiator;
  conversation_id: string | null;
  payment_status: string;
};

export type VendorBookingsListResponse = {
  success: boolean;
  bookings: VendorBookingListItem[];
};

export type VendorBookingLineItem = {
  id: string;
  heading: string;
  unit_price_gbp: number | null;
  description?: string | null;
  feature_lines?: string[];
  timeline_line?: string | null;
};

export type VendorBookingDetail = {
  id: string;
  status: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  event_postcode: string | null;
  event_address: string | null;
  notes: string | null;
  total_label: string;
  selected_option_ids: string[];
  line_items: VendorBookingLineItem[];
  vendor_adjustments: VendorAdjustmentItem[];
  pricing: BookingPricingBreakdown | null;
  client_user_id: string | null;
  client_email: string | null;
  created_at: string | null;
  /** Set automatically when payment succeeds (e.g. Stripe webhook). */
  paid_at: string | null;
  /** Money lifecycle, independent of `status`: unpaid/pending/paid/refunded/partially_refunded/payout_released. */
  payment_status: string;
  client_completion_confirmed_at: string | null;
  vendor_completion_confirmed_at: string | null;
  review: VendorReviewSummary | null;
  initiator?: BookingInitiator;
  counterparty_phone?: string | null;
  conversation_id: string | null;
};

export type VendorBookingDetailResponse = {
  success: boolean;
  booking: VendorBookingDetail;
};

export type VendorBookingStatusResponse = {
  success: boolean;
  id: string;
  status: string;
};

export async function fetchVendorBookings(
  group: VendorBookingsListGroup = "active",
): Promise<VendorBookingListItem[]> {
  const { data } = await api.get<VendorBookingsListResponse>(
    "/api/v1/vendor/booking-requests",
    { params: { group } },
  );
  return data.bookings ?? [];
}

export async function patchVendorBookingStatus(
  bookingId: string,
  status: "accepted" | "declined" | "cancelled",
): Promise<VendorBookingStatusResponse> {
  const { data } = await api.patch<VendorBookingStatusResponse>(
    `/api/v1/vendor/booking-requests/${bookingId}/status`,
    { status },
  );
  return data;
}

export type ConfirmCompletionResponse = {
  success: boolean;
  id: string;
  status: string;
  payment_status: string;
  awaiting_other_party: boolean;
};

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
): Promise<{ id: string; status: string; created_at: string | null }> {
  const { data } = await api.post<{
    success: boolean;
    id: string;
    status: string;
    created_at: string | null;
  }>("/api/v1/vendor/booking-requests/vendor-quote", body);
  return {
    id: data.id,
    status: data.status,
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
  tag: string;
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
