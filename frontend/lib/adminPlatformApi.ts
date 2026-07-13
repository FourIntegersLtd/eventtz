import api from "@/lib/axios";

export type AdminDashboardSummary = {
  success: boolean;
  users_client: number;
  users_vendor: number;
  users_admin: number;
  vendors_pending: number;
  vendors_approved: number;
  vendors_banned: number;
  bookings_pending: number;
  bookings_accepted: number;
  bookings_completed: number;
  bookings_declined: number;
  bookings_cancelled: number;
  bookings_paid_count: number;
  bookings_needing_support: number;
  conversations_count: number;
  reviews_count: number;
};

export type AdminDashboardTimeBucket = {
  date: string;
  count: number;
  gmv_gbp: number;
};

export type AdminDashboardSignupBucket = {
  date: string;
  clients: number;
  vendors: number;
};

export type AdminDashboardMetrics = {
  success: boolean;
  period_days: number;
  bookings_created: AdminDashboardTimeBucket[];
  bookings_paid: AdminDashboardTimeBucket[];
  signups: AdminDashboardSignupBucket[];
  open_disputes_count: number;
};

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

export type AdminFinancialsDailyBucket = {
  date: string;
  count: number;
  gmv_gbp: number;
  platform_fee_gbp: number;
  vendor_portion_gbp: number;
};

export type AdminFinancialsSummary = {
  success: boolean;
  period_from: string | null;
  period_to: string | null;
  paid_booking_count: number;
  gmv_gbp: number;
  platform_fee_gbp: number;
  vendor_portion_gbp: number;
  service_fee_percent: number;
  /** Vendor portion already sent out via Stripe Transfer. */
  payout_released_gbp: number;
  /** Vendor portion collected but still sitting in Eventtz's Stripe balance. */
  held_in_platform_balance_gbp: number;
  /** Present once backend exposes time-series buckets; empty when unavailable. */
  daily?: AdminFinancialsDailyBucket[];
  disclaimer: string;
};

export type AdminClientRow = {
  user_id: string;
  email?: string | null;
  created_at?: string | null;
  account_suspended: boolean;
  booking_count: number;
};

export type AdminDisputeCase = {
  id: string;
  booking_request_id: string;
  opened_by_user_id: string;
  status: "open" | "under_review" | "resolved" | "closed";
  summary: string;
  internal_notes?: string | null;
  resolution_note?: string | null;
  assigned_admin_id?: string | null;
  assigned_admin_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
  /** In-app chat thread captured when the dispute was opened (if any). */
  conversation_id?: string | null;
  /** Money decision recorded when the dispute was resolved. */
  resolution_action?: "release_to_vendor" | "refund_client" | "partial_refund" | null;
  refund_amount_gbp?: number | null;
  event_name?: string | null;
  event_date?: string | null;
  booking_status?: string | null;
  client_email?: string | null;
  vendor_display_name?: string | null;
  vendor_email?: string | null;
  opened_by_role?: "client" | "vendor" | null;
  opened_by_email?: string | null;
  opened_by_display_name?: string | null;
};

export type AdminReviewRow = {
  id: string;
  booking_request_id: string;
  vendor_user_id: string;
  client_user_id: string;
  rating: number;
  body: string;
  hidden_at?: string | null;
  created_at?: string | null;
  vendor_display_name?: string | null;
  client_email?: string | null;
  booking_event_name?: string | null;
  booking_event_date?: string | null;
  booking_status?: string | null;
};

export type AdminChatMessageItem = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at?: string | null;
};

export type AdminAuditLogItem = {
  id: string;
  admin_user_id?: string | null;
  admin_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data } = await api.get<AdminDashboardSummary>("/api/v1/admin/dashboard-summary");
  return data;
}

export async function fetchAdminDashboardMetrics(days = 30): Promise<AdminDashboardMetrics> {
  const { data } = await api.get<AdminDashboardMetrics>("/api/v1/admin/dashboard-metrics", {
    params: { days },
  });
  return data;
}

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

export async function fetchAdminFinancials(
  date_from?: string,
  date_to?: string,
): Promise<AdminFinancialsSummary> {
  const { data } = await api.get<AdminFinancialsSummary>("/api/v1/admin/financials/summary", {
    params: { date_from, date_to },
  });
  return { ...data, daily: data.daily ?? [] };
}

export async function downloadAdminFinancialsCsv(date_from?: string, date_to?: string): Promise<void> {
  const { data } = await api.get<Blob>("/api/v1/admin/financials/export.csv", {
    params: { date_from, date_to },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eventtz-financials.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchAdminClients(): Promise<AdminClientRow[]> {
  const { data } = await api.get<{ success: boolean; clients: AdminClientRow[] }>(
    "/api/v1/admin/clients",
  );
  return data.clients ?? [];
}

export async function patchClientSuspended(userId: string, suspended: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/clients/${userId}/suspended`, { suspended });
}

export async function fetchAdminDisputes(): Promise<AdminDisputeCase[]> {
  const { data } = await api.get<{ success: boolean; disputes: AdminDisputeCase[] }>(
    "/api/v1/admin/disputes",
  );
  return data.disputes ?? [];
}

export async function patchAdminDispute(
  disputeId: string,
  body: {
    status?: AdminDisputeCase["status"];
    internal_notes?: string | null;
    resolution_note?: string | null;
    assigned_admin_id?: string | null;
    /** Only acted on when status is being set to "resolved". */
    resolution_action?: "release_to_vendor" | "refund_client" | "partial_refund" | null;
    /** Required (and only used) when resolution_action === "partial_refund". */
    refund_amount_gbp?: number | null;
  },
): Promise<AdminDisputeCase> {
  const { data } = await api.patch<AdminDisputeCase>(`/api/v1/admin/disputes/${disputeId}`, body);
  return data;
}

export async function fetchAdminReviews(
  offset = 0,
  limit = 100,
  vendorUserId?: string | null,
): Promise<{
  reviews: AdminReviewRow[];
  total: number;
}> {
  const params: Record<string, string | number> = { offset, limit };
  const vendorId = vendorUserId?.trim();
  if (vendorId) params.vendor_user_id = vendorId;
  const { data } = await api.get<{
    success: boolean;
    reviews: AdminReviewRow[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/reviews", { params });
  return { reviews: data.reviews ?? [], total: data.total ?? 0 };
}

export async function fetchAdminReview(reviewId: string): Promise<AdminReviewRow> {
  const { data } = await api.get<{ success: boolean; review: AdminReviewRow }>(
    `/api/v1/admin/reviews/${reviewId}`,
  );
  if (!data.review) {
    throw new Error("Review not found");
  }
  return data.review;
}

export async function patchReviewVisibility(reviewId: string, hidden: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/reviews/${reviewId}/visibility`, { hidden });
}

export type AdminChatConversationPayload = {
  conversation_id: string;
  messages: AdminChatMessageItem[];
  client_user_id: string | null;
  vendor_user_id: string | null;
  client_email: string | null;
  vendor_display_name: string | null;
};

export async function fetchAdminChatMessages(
  conversationId: string,
): Promise<AdminChatConversationPayload> {
  const { data } = await api.get<AdminChatConversationPayload>(
    `/api/v1/admin/chat/conversations/${conversationId}/messages`,
  );
  return {
    conversation_id: data.conversation_id,
    messages: data.messages ?? [],
    client_user_id: data.client_user_id ?? null,
    vendor_user_id: data.vendor_user_id ?? null,
    client_email: data.client_email ?? null,
    vendor_display_name: data.vendor_display_name ?? null,
  };
}

export async function fetchAdminAuditLog(offset = 0, limit = 100): Promise<{
  entries: AdminAuditLogItem[];
  total: number;
}> {
  const { data } = await api.get<{
    success: boolean;
    entries: AdminAuditLogItem[];
    total: number;
  }>("/api/v1/admin/audit-log", { params: { offset, limit } });
  return { entries: data.entries ?? [], total: data.total ?? 0 };
}

export async function fetchAdminAuditLogEntry(entryId: string): Promise<AdminAuditLogItem> {
  const { data } = await api.get<{ success: boolean; entry: AdminAuditLogItem }>(
    `/api/v1/admin/audit-log/${entryId}`,
  );
  return data.entry;
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
