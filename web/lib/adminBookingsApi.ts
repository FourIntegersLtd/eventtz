import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type AdminBookingListSupportSummary = components["schemas"]["AdminBookingListSupportSummary"];

export type AdminBookingListItem = components["schemas"]["AdminBookingListItem"];

export type AdminBookingsListResponse = components["schemas"]["AdminBookingsListResponse"];

export type AdminBookingsQuery = {
  offset?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  needs_attention?: boolean;
};

export async function fetchAdminBookings(
  q: AdminBookingsQuery = {},
): Promise<AdminBookingsListResponse> {
  const { data } = await api.get<components["schemas"]["AdminBookingsListResponse"]>("/api/v1/admin/bookings", {
    params: q,
  });
  return data;
}

export async function fetchAdminBookingDetail(bookingId: string): Promise<AdminBookingDetail> {
  const { data } = await api.get<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${bookingId}`,
  );
  return data.booking;
}

export async function patchBookingPaymentFields(
  bookingId: string,
  body: Partial<components["schemas"]["AdminPaymentFieldsPatchBody"]>,
): Promise<void> {
  await api.patch(`/api/v1/admin/bookings/${bookingId}/payment-fields`, body);
}

export type AdminBookingAttentionFlag = components["schemas"]["AdminBookingNeedsAttentionFlag"];

export type AdminBookingSupportMeta = components["schemas"]["AdminBookingSupportMeta"];

export type AdminBookingDetail = components["schemas"]["AdminBookingDetail"];

async function postAdminBookingAction(
  bookingId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<AdminBookingDetail> {
  const { data } = await api.post<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${bookingId}/${action}`,
    body ?? {},
  );
  return data.booking;
}

export async function adminSyncBookingPayment(bookingId: string): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "sync-payment");
}

export async function adminResetBookingCheckout(bookingId: string): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "reset-checkout");
}

export async function adminReleaseBookingPayout(bookingId: string): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "release-payout");
}

export async function adminRetryBookingPayout(bookingId: string): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "retry-payout");
}

export async function adminCompleteBookingCancellation(
  bookingId: string,
): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "complete-cancellation");
}

export async function adminCancelBookingOnBehalf(
  bookingId: string,
  body: Omit<components["schemas"]["AdminCancelOnBehalfBody"], "exceptional"> &
    Partial<Pick<components["schemas"]["AdminCancelOnBehalfBody"], "exceptional">>,
): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "cancel-on-behalf", body);
}

export async function adminConfirmBookingCompletion(
  bookingId: string,
  body: components["schemas"]["AdminConfirmCompletionBody"],
): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "confirm-completion", body);
}

export async function adminRunBookingMaintenance(bookingId: string): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "run-maintenance");
}

export async function adminSetBookingSupportHold(
  bookingId: string,
  hold: boolean,
): Promise<AdminBookingDetail> {
  const { data } = await api.patch<components["schemas"]["AdminBookingDetailResponse"]>(
    `/api/v1/admin/bookings/${bookingId}/support-hold`,
    { hold } satisfies components["schemas"]["AdminSupportHoldBody"],
  );
  return data.booking;
}

/** Staff decide a deposit claim: how much the vendor keeps (0 up to the claim). */
export async function adminResolveDepositClaim(bookingId: string, awardGbp: number): Promise<void> {
  await api.post(`/api/v1/admin/bookings/${bookingId}/deposit-claim/resolve`, {
    award_gbp: awardGbp,
  });
}
