import type { components } from "@/lib/api-schema";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";
import type {
  BookingInitiator,
  BookingPricingBreakdown,
  ConfirmCompletionResponse,
  ParticipantBookingsListGroup,
  VendorAdjustmentItem,
  BookingLineItem,
} from "@/lib/domain-types";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
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

export type BookingRequestCreated = components["schemas"]["BookingRequestCreated"];

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
  q?: string;
};

export type ClientBookingListItem = components["schemas"]["ClientBookingListItem"];

export type ClientBookingsListResponse = components["schemas"]["ClientBookingsListResponse"];

export type ClientBookingsPage = {
  bookings: ClientBookingListItem[];
  total: number;
  offset: number;
  limit: number;
};

export const CLIENT_BOOKINGS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

/**
 * The api types `line_items` as free-form dicts (real row shape: `BookingLineItem`), and the review form
 * hands back a `BookingReviewDisplay` whose `image_urls` may be absent.
 */
export type ClientBookingDetail = WithFields<
  components["schemas"]["ClientBookingDetail"],
  { line_items: BookingLineItem[]; review: BookingReviewDisplay | null }
>;

export type ClientCancellationPreview = NonNullable<ClientBookingDetail["cancellation_preview"]>;

export type ClientBookingDetailResponse = WithFields<
  components["schemas"]["ClientBookingDetailResponse"],
  { booking: ClientBookingDetail }
>;

export type ClientBookingsListParamsWithPage = ClientBookingsListParams & {
  offset?: number;
  limit?: number;
};

export async function fetchClientBookingsPage(
  groupOrParams: ClientBookingsListGroup | ClientBookingsListParamsWithPage = "active",
): Promise<ClientBookingsPage> {
  const params: ClientBookingsListParamsWithPage =
    typeof groupOrParams === "string" ? { group: groupOrParams } : groupOrParams;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? CLIENT_BOOKINGS_PAGE_SIZE;
  const { data } = await api.get<ClientBookingsListResponse>(
    "/api/v1/client/booking-requests",
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

/** @deprecated Prefer paginated `fetchClientBookingsPage` or `fetchClientDashboard`. */
export async function fetchClientBookings(
  groupOrParams: ClientBookingsListGroup | ClientBookingsListParamsWithPage = "active",
): Promise<ClientBookingListItem[]> {
  const page = await fetchClientBookingsPage({
    ...(typeof groupOrParams === "string" ? { group: groupOrParams } : groupOrParams),
    offset: 0,
    limit: 200,
  });
  return page.bookings;
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
