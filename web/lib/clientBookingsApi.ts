import api from "@/lib/axios";
import type { BookingTermsFields } from "@/features/bookings/bookingTerms";
import type {
  BookingInitiator,
  BookingPricingBreakdown,
  ConfirmCompletionResponse,
  ParticipantBookingsListGroup,
  VendorAdjustmentItem,
  BookingLineItem,
} from "@/lib/domain-types";

export type ClientSearchContext = {
  q?: string;
  types?: string[];
  location?: string;
  country?: string;
  dates?: string[];
  dateFlexible?: boolean;
  /** Set when sending the same brief to several vendors (analytics). */
  batchSize?: number;
  batchIndex?: number;
  /** Where the enquiry originated. */
  source?: "browse" | "multi" | "planner";
  /** AI planner plan id when source is planner. */
  plannerPlanId?: string;
};

export type CreateBookingRequestPayload = {
  vendor_user_id: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  /** Venue / event location postcode (optional at request; required before pay). */
  event_postcode?: string | null;
  /** Free-text venue address line(s). */
  event_address?: string | null;
  notes: string | null;
  selected_option_ids: string[];
  /** Client-chosen counts for per-item packages. */
  quantities?: Record<string, number> | null;
  /** Marketplace filters at enquire time (for alternative-vendor nudges). */
  client_search_context?: ClientSearchContext | null;
  event_id?: string | null;
  vendor_referral_code?: string | null;
};

export type BookingRequestCreated = {
  success: boolean;
  booking_request_id: string;
  booking_status: string;
  created_at: string | null;
  event_id?: string | null;
};

export async function postBookingRequest(
  payload: CreateBookingRequestPayload,
): Promise<BookingRequestCreated> {
  const { data } = await api.post<BookingRequestCreated>("/api/v1/client/booking-requests", payload);
  return data;
}

export type {
  BookingInitiator,
  BookingPricingBreakdown,
  ConfirmCompletionResponse,
  ParticipantBookingsListGroup,
  VendorAdjustmentItem,
  BookingLineItem as ClientBookingLineItem,
};

/** List filter: active = pending+accepted, closed = declined+cancelled+completed, all = no bucket */
export type ClientBookingsListGroup = ParticipantBookingsListGroup | "all";

export type ClientBookingsListParams = {
  group?: ClientBookingsListGroup;
  status?: string;
  payment_status?: string;
  exclude_payment_status?: string;
};

export type ClientBookingListItem = {
  booking_request_id: string;
  booking_status: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  total_label: string;
  client_total_label: string | null;
  vendor_user_id: string;
  vendor_display_name: string;
  created_at: string | null;
  updated_at?: string | null;
  initiator?: BookingInitiator;
  conversation_id: string | null;
  /** Only meaningful for `group: "completed"` rows - powers the review nudge. */
  has_review: boolean;
  payment_status: string;
  has_price_update?: boolean;
  /** Who still needs to confirm the event went well (accepted + paid bookings). */
  completion_waiting_on?: "client" | "vendor" | "both" | null;
  client_completion_confirmed_at?: string | null;
  event_id?: string | null;
  event_title?: string | null;
};

export type ClientBookingsListResponse = {
  success: boolean;
  bookings: ClientBookingListItem[];
};

export type ClientBookingDetail = BookingTermsFields & {
  booking_request_id: string;
  booking_status: string;
  vendor_user_id: string;
  vendor_display_name: string;
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
  /** Present when the client has submitted a review for this booking. */
  review?: {
    id: string;
    rating: number;
    body: string;
    created_at: string | null;
    image_urls?: string[];
  } | null;
  initiator?: BookingInitiator;
  conversation_id: string | null;
  counterparty_phone?: string | null;
  /** Client-facing total at request time (before vendor price changes). */
  initial_client_total_label?: string | null;
  vendor_referral_code?: string | null;
  /** Vendor's client-cancellation preset (current preset while unpaid). */
  cancellation_policy?: string | null;
  cancellation_policy_label?: string | null;
  cancellation_policy_lines?: string[];
  /** What cancelling now would refund; present only while paid and pending/accepted. */
  cancellation_preview?: ClientCancellationPreview | null;
  /** Set after a cancellation: share of the vendor's price refunded. */
  cancellation_refund_percent?: number | null;
  cancellation_refund_gbp?: number | null;
};

export type ClientCancellationPreview = {
  percent: number;
  refund_gbp: number;
  refund_label: string;
  cooling_off_until: string | null;
  next_tier_at: string | null;
  next_tier_percent: number | null;
  lines: string[];
};

export type ClientBookingDetailResponse = {
  success: boolean;
  booking: ClientBookingDetail;
};

export async function fetchClientBookings(
  groupOrParams: ClientBookingsListGroup | ClientBookingsListParams = "active",
): Promise<ClientBookingListItem[]> {
  const params: ClientBookingsListParams =
    typeof groupOrParams === "string" ? { group: groupOrParams } : groupOrParams;
  const { data } = await api.get<ClientBookingsListResponse>(
    "/api/v1/client/booking-requests",
    {
      params: {
        group: params.group ?? "active",
        ...(params.status ? { status: params.status } : {}),
        ...(params.payment_status ? { payment_status: params.payment_status } : {}),
        ...(params.exclude_payment_status
          ? { exclude_payment_status: params.exclude_payment_status }
          : {}),
      },
    },
  );
  return data.bookings ?? [];
}

export async function fetchClientBookingDetail(
  bookingId: string,
): Promise<ClientBookingDetail> {
  const { data } = await api.get<ClientBookingDetailResponse>(
    `/api/v1/client/booking-requests/${bookingId}`,
  );
  return data.booking;
}

export type ClientBookingCancelResponse = {
  success: boolean;
  booking_request_id: string;
  booking_status: string;
  refund_percent?: number | null;
  refund_gbp?: number | null;
};

export async function postCancelClientBooking(
  bookingId: string,
): Promise<ClientBookingCancelResponse> {
  const { data } = await api.post<ClientBookingCancelResponse>(
    `/api/v1/client/booking-requests/${bookingId}/cancel`,
  );
  return data;
}

export type ClientBookingStatusResponse = {
  success: boolean;
  booking_request_id: string;
  booking_status: string;
};

export async function patchClientBookingStatus(
  bookingId: string,
  bookingStatus: "accepted" | "declined",
  venue?: { event_postcode: string; event_address?: string | null },
): Promise<ClientBookingStatusResponse> {
  const body: {
    booking_status: "accepted" | "declined";
    event_postcode?: string;
    event_address?: string | null;
  } = { booking_status: bookingStatus };
  if (bookingStatus === "accepted" && venue) {
    body.event_postcode = venue.event_postcode;
    const line = venue.event_address?.trim();
    if (line) body.event_address = line;
  }
  const { data } = await api.patch<ClientBookingStatusResponse>(
    `/api/v1/client/booking-requests/${bookingId}/status`,
    body,
  );
  return data;
}

export async function patchClientBookingVenue(
  bookingId: string,
  venue: { event_address: string; event_postcode?: string | null },
): Promise<ClientBookingDetail> {
  const { data } = await api.patch<ClientBookingDetailResponse>(
    `/api/v1/client/booking-requests/${bookingId}/venue`,
    venue,
  );
  return data.booking;
}
export async function postClientConfirmCompletion(
  bookingId: string,
): Promise<ConfirmCompletionResponse> {
  const { data } = await api.post<ConfirmCompletionResponse>(
    `/api/v1/client/booking-requests/${bookingId}/confirm-completion`,
  );
  return data;
}

/** Client confirms the photos/video arrived, releasing the rest of the vendor's payout. */
export async function postClientConfirmDelivery(bookingId: string): Promise<void> {
  await api.post(`/api/v1/client/booking-requests/${bookingId}/confirm-delivery`);
}
