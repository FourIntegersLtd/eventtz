import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";
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

export type VendorReviewSummary = components["schemas"]["VendorReviewSummary"];

export type VendorBookingListItem = components["schemas"]["VendorBookingListItem"];

export type VendorBookingsListResponse = components["schemas"]["VendorBookingsListResponse"];

export type VendorBookingsPage = {
  bookings: VendorBookingListItem[];
  total: number;
  offset: number;
  limit: number;
};

export const VENDOR_BOOKINGS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

/** The api types `line_items` as free-form dicts; the real row shape is `BookingLineItem`. */
export type VendorBookingDetail = WithFields<
  components["schemas"]["VendorBookingDetail"],
  { line_items: BookingLineItem[] }
>;

export type VendorBookingDetailResponse = WithFields<
  components["schemas"]["VendorBookingDetailResponse"],
  { booking: VendorBookingDetail }
>;

export type VendorBookingStatusResponse = components["schemas"]["VendorBookingStatusResponse"];

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
