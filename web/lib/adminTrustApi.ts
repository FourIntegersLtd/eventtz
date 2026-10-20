import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminDisputeCase = {
  id: string;
  booking_request_id: string;
  opened_by_user_id: string;
  status: "open" | "under_review" | "resolved" | "closed";
  summary: string;
  internal_notes?: string | null;
  resolution_note?: string | null;
  client_resolution_note?: string | null;
  vendor_resolution_note?: string | null;
  assigned_admin_id?: string | null;
  assigned_admin_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  resolved_at?: string | null;
  /** In-app chat thread captured when the dispute was opened (if any). */
  conversation_id?: string | null;
  /** Money decision recorded when the dispute was resolved. */
  resolution_action?: "release_to_vendor" | "refund_client" | "partial_refund" | "vendor_no_show" | null;
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

export const ADMIN_DISPUTES_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchAdminDisputesPage(
  status = "all",
  offset = 0,
  limit = ADMIN_DISPUTES_PAGE_SIZE,
  search?: string | null,
): Promise<{
  disputes: AdminDisputeCase[];
  total: number;
  offset: number;
  limit: number;
}> {
  const params: Record<string, string | number> = { status, offset, limit };
  const query = search?.trim();
  if (query) params.search = query;
  const { data } = await api.get<{
    success: boolean;
    disputes: AdminDisputeCase[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/disputes", { params });
  return {
    disputes: data.disputes ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

/** Loads the first page only; prefer {@link fetchAdminDisputesPage} for list screens. */
export async function fetchAdminDisputes(status = "all"): Promise<AdminDisputeCase[]> {
  const page = await fetchAdminDisputesPage(status, 0, 200);
  return page.disputes;
}

export async function patchAdminDispute(
  disputeId: string,
  body: {
    status?: AdminDisputeCase["status"];
    internal_notes?: string | null;
    resolution_note?: string | null;
    client_resolution_note?: string | null;
    vendor_resolution_note?: string | null;
    assigned_admin_id?: string | null;
    /** Only acted on when status is being set to "resolved". */
    resolution_action?: "release_to_vendor" | "refund_client" | "partial_refund" | "vendor_no_show" | null;
    /** Required (and only used) when resolution_action === "partial_refund". */
    refund_amount_gbp?: number | null;
  },
): Promise<AdminDisputeCase> {
  const { data } = await api.patch<AdminDisputeCase>(`/api/v1/admin/disputes/${disputeId}`, body);
  return data;
}

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

export async function fetchAdminReviews(
  offset = 0,
  limit = 100,
  vendorUserId?: string | null,
  visibility: "all" | "published" | "hidden" = "all",
): Promise<{
  reviews: AdminReviewRow[];
  total: number;
}> {
  const params: Record<string, string | number> = { offset, limit, visibility };
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

export type AdminChatMessageItem = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at?: string | null;
};

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
