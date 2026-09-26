import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminBookingDetail = components["schemas"]["AdminBookingDetail"];
export type AdminBookingListItem = components["schemas"]["AdminBookingListItem"];

/** One booking, admin-eyes view: every column plus support diagnostics. */
export async function fetchAdminBookingDetail(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}`,
  );
  return response.booking;
}

/** Overwrites Stripe reference fields by hand, after verifying them with Stripe. Super admin only. */
export async function patchBookingPaymentFields(
  bookingId: string,
  body: components["schemas"]["AdminPaymentFieldsPatchBody"],
): Promise<void> {
  await platformRequest<components["schemas"]["AdminPaymentFieldsPatchResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/payment-fields`,
    { method: "PATCH", body },
  );
}

/**
 * Clears a stuck checkout session so the client can pay again from scratch.
 * The baseline calls this "Unblock checkout"; super admin only.
 */
export async function adminResetBookingCheckout(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/reset-checkout`,
    { method: "POST" },
  );
  return response.booking;
}

/** Pauses or resumes this booking's automatic payout release. Super admin only. */
export async function adminSetBookingSupportHold(bookingId: string, hold: boolean): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/support-hold`,
    { method: "PATCH", body: { hold } },
  );
  return response.booking;
}

/** Asks Stripe whether the client paid and marks the booking paid when they did. Super admin only. */
export async function adminSyncBookingPayment(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/sync-payment`,
    { method: "POST" },
  );
  return response.booking;
}

/** Pays the vendor once both parties confirmed the event happened, or the auto-release date passed. Super admin only. */
export async function adminReleaseBookingPayout(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/release-payout`,
    { method: "POST" },
  );
  return response.booking;
}

/** Retries a vendor payout that previously failed (same tool as release, audited separately). Super admin only. */
export async function adminRetryBookingPayout(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/retry-payout`,
    { method: "POST" },
  );
  return response.booking;
}

/** Marks a refunded booking cancelled when the cancel flow stopped halfway. Super admin only. */
export async function adminCompleteBookingCancellation(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/complete-cancellation`,
    { method: "POST" },
  );
  return response.booking;
}

/** Cancels (and refunds, if paid) on behalf of a client or vendor who asked support to. Super admin only. */
export async function adminCancelBookingOnBehalf(
  bookingId: string,
  body: components["schemas"]["AdminCancelOnBehalfBody"],
): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/cancel-on-behalf`,
    { method: "POST", body },
  );
  return response.booking;
}

/** Confirms the event went ahead for one party; the vendor is paid once both have confirmed. Super admin only. */
export async function adminConfirmBookingCompletion(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/confirm-completion`,
    { method: "POST" },
  );
  return response.booking;
}

/** Runs the post-event maintenance step now: the completion reminder, then any payout that is due. Super admin only. */
export async function adminRunBookingMaintenance(bookingId: string): Promise<AdminBookingDetail> {
  const response = await platformRequest<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${encodeURIComponent(bookingId)}/run-maintenance`,
    { method: "POST" },
  );
  return response.booking;
}

/** One page of the admin bookings list (used by the Commerce screen's Bookings tab). */
export interface AdminBookingsQuery {
  offset?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  needs_attention?: boolean;
}

export async function fetchAdminBookings(
  query: AdminBookingsQuery = {},
): Promise<{ bookings: AdminBookingListItem[]; total: number; offset: number; limit: number }> {
  const response = await platformRequest<components["schemas"]["AdminBookingsListResponse"]>(
    "/api/v1/admin/bookings",
    { query: { ...query } },
  );
  return response;
}
