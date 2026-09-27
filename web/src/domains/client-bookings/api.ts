/**
 * The client bookings domain's requests against the platform API.
 *
 * Components never call `platformRequest` directly (enforced by
 * `eslint.config.mjs`) — they go through the exported functions here. Every
 * shape is re-exported from the generated `schema.d.ts` rather than
 * hand-typed, so a change to `api/openapi.json` shows up at compile time.
 */
import { platformRequest, type components } from "@/foundation/platform-client";
import { checkoutSyncBody } from "@/domains/client-bookings/checkoutReturn";

export type ClientBookingListItem = components["schemas"]["ClientBookingListItem"];
export type ClientBookingDetail = components["schemas"]["ClientBookingDetail"];
export type ClientReviewSummary = components["schemas"]["ClientReviewSummary"];
export type VendorAdjustmentItem = components["schemas"]["VendorAdjustmentItem"];
export type BookingPricingBreakdown = components["schemas"]["BookingPricingBreakdown"];
export type UpdateBookingVenueBody = components["schemas"]["UpdateBookingVenueBody"];
export type PostBookingReviewBody = components["schemas"]["PostBookingReviewBody"];

/** The bucket a client booking falls into on the list screen. */
export type ClientBookingsListGroup = "active" | "closed" | "completed" | "all";

/** Optional filters accepted by `GET /client/booking-requests`. */
export type ClientBookingsListParams = {
  group?: ClientBookingsListGroup;
  status?: string;
  paymentStatus?: string;
  excludePaymentStatus?: string;
};

/** The client's bookings in one bucket, most recently active first. */
export async function fetchClientBookings(
  params: ClientBookingsListParams = {},
): Promise<ClientBookingListItem[]> {
  const response = await platformRequest<components["schemas"]["ClientBookingsListResponse"]>(
    "/api/v1/client/booking-requests",
    {
      query: {
        group: params.group ?? "active",
        status: params.status,
        payment_status: params.paymentStatus,
        exclude_payment_status: params.excludePaymentStatus,
      },
    },
  );
  return response.bookings;
}

/** One booking with its price breakdown, the vendor's phone once paid, and any review. */
export async function fetchClientBookingDetail(bookingId: string): Promise<ClientBookingDetail> {
  const response = await platformRequest<components["schemas"]["ClientBookingDetailResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}`,
  );
  return response.booking;
}

/** Cancel a pending or accepted booking (a paid one is refunded in full first). */
export async function postCancelClientBooking(
  bookingId: string,
): Promise<components["schemas"]["VendorBookingStatusResponse"]> {
  return platformRequest<components["schemas"]["VendorBookingStatusResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/cancel`,
    { method: "POST" },
  );
}

/** Accept or decline a vendor's quote or updated price. */
export async function patchClientBookingStatus(
  bookingId: string,
  status: components["schemas"]["ClientBookingStatusBody"]["status"],
): Promise<components["schemas"]["VendorBookingStatusResponse"]> {
  return platformRequest<components["schemas"]["VendorBookingStatusResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/status`,
    { method: "PATCH", body: { status } },
  );
}

/**
 * Starts Stripe Checkout for an accepted, unpaid booking. No request body:
 * the server prices the booking. Returns the hosted Checkout URL unchanged.
 */
export async function postClientBookingCheckout(bookingId: string): Promise<string> {
  const response = await platformRequest<components["schemas"]["BookingCheckoutResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/checkout`,
    { method: "POST" },
  );
  return response.checkout_url;
}

/**
 * Asks the server to check the Checkout session with Stripe and report the
 * booking's payment status. A return URL includes `session_id`; a silent
 * sync of a still-pending booking sends `{}`.
 */
export async function postClientBookingCheckoutSync(
  bookingId: string,
  sessionId?: string | null,
): Promise<components["schemas"]["BookingCheckoutSyncResponse"]> {
  return platformRequest<components["schemas"]["BookingCheckoutSyncResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/checkout/sync`,
    { method: "POST", body: checkoutSyncBody(sessionId) },
  );
}

/** Set the venue of an accepted booking before paying. */
export async function patchClientBookingVenue(
  bookingId: string,
  body: UpdateBookingVenueBody,
): Promise<ClientBookingDetail> {
  const response = await platformRequest<components["schemas"]["ClientBookingDetailResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/venue`,
    { method: "PATCH", body },
  );
  return response.booking;
}

/** Confirm the event went ahead; the payout follows once the vendor confirms too. */
export async function postClientConfirmCompletion(
  bookingId: string,
): Promise<components["schemas"]["ConfirmCompletionResponse"]> {
  return platformRequest<components["schemas"]["ConfirmCompletionResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/confirm-completion`,
    { method: "POST" },
  );
}

/** Submit a review of the vendor for a completed booking. */
export async function postClientBookingReview(
  bookingId: string,
  body: PostBookingReviewBody,
): Promise<components["schemas"]["PostBookingReviewResponse"]> {
  return platformRequest<components["schemas"]["PostBookingReviewResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/review`,
    { method: "POST", body },
  );
}

/**
 * Mark every booking notice read. The baseline does this whenever the client
 * opens their bookings, so the sidebar's booking badge clears.
 */
export function markAllClientBookingNotificationsRead(): Promise<void> {
  return platformRequest<void>("/api/v1/client/notifications/bookings/mark-all-read", { method: "POST" });
}

/** A dispute on one of the client's bookings, as the client is allowed to see it. */
export type ClientBookingDispute = components["schemas"]["DisputePublic"];

/** Disputes on this booking; an empty list if the client isn't a party to it. */
export function fetchClientBookingDisputes(bookingId: string): Promise<ClientBookingDispute[]> {
  return platformRequest<components["schemas"]["DisputesListResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/disputes`,
  ).then((response) => response.disputes);
}

/** Open a dispute on one of the client's own bookings. The summary is the client's own words. */
export function postClientBookingDispute(bookingId: string, summary: string): Promise<ClientBookingDispute> {
  return platformRequest<components["schemas"]["CreateDisputeResponse"]>(
    `/api/v1/client/booking-requests/${encodeURIComponent(bookingId)}/disputes`,
    { method: "POST", body: { summary } },
  ).then((response) => response.dispute);
}
