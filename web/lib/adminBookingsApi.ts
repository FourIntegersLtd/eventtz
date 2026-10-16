import api from "@/lib/axios";

export type AdminBookingListSupportSummary = {
  needs_attention_count: number;
  max_severity: "critical" | "warning" | null;
  primary_label: string | null;
  next_action: string | null;
};

export type AdminBookingListItem = {
  id: string;
  status: string;
  event_name: string;
  event_date: string;
  client_email?: string | null;
  vendor_email?: string | null;
  vendor_display_name: string;
  created_at?: string | null;
  client_total_label?: string | null;
  paid_at?: string | null;
  payment_status: string;
  support?: AdminBookingListSupportSummary | null;
};

export type AdminBookingsListResponse = {
  success: boolean;
  bookings: AdminBookingListItem[];
  total: number;
  offset: number;
  limit: number;
};

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
  const { data } = await api.get<AdminBookingsListResponse>("/api/v1/admin/bookings", {
    params: q,
  });
  return data;
}

export async function fetchAdminBookingDetail(bookingId: string): Promise<Record<string, unknown>> {
  const { data } = await api.get<{ success: boolean; booking: Record<string, unknown> }>(
    `/api/v1/admin/bookings/${bookingId}`,
  );
  return data.booking;
}

export async function patchBookingPaymentFields(
  bookingId: string,
  body: {
    stripe_payment_intent_id?: string | null;
    stripe_charge_id?: string | null;
    payment_amount_gbp?: number | null;
  },
): Promise<void> {
  await api.patch(`/api/v1/admin/bookings/${bookingId}/payment-fields`, body);
}

export type AdminBookingAttentionFlag = {
  code: string;
  severity: "critical" | "warning";
  label: string;
};

export type AdminBookingSupportMeta = {
  needs_attention: AdminBookingAttentionFlag[];
  open_dispute: {
    id: string;
    status: string;
    summary: string;
    created_at?: string | null;
  } | null;
  support_hold: boolean;
  vendor_stripe_payouts_enabled: boolean;
  next_action: string | null;
};

export type AdminBookingDetail = Record<string, unknown> & {
  support?: AdminBookingSupportMeta;
};

async function postAdminBookingAction(
  bookingId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<AdminBookingDetail> {
  const { data } = await api.post<{ success: boolean; booking: AdminBookingDetail }>(
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
  body: { party: "client" | "vendor"; reason: string },
): Promise<AdminBookingDetail> {
  return postAdminBookingAction(bookingId, "cancel-on-behalf", body);
}

export async function adminConfirmBookingCompletion(
  bookingId: string,
  body: { party: "client" | "vendor" },
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
  const { data } = await api.patch<{ success: boolean; booking: AdminBookingDetail }>(
    `/api/v1/admin/bookings/${bookingId}/support-hold`,
    { hold },
  );
  return data.booking;
}
