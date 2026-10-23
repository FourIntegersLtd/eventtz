import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminDisputeCase = components["schemas"]["AdminDisputeCase"];


export async function fetchAdminDisputesPage(
  status = "all",
  offset = 0,
  limit = DEFAULT_LIST_PAGE_SIZE,
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
  const { data } = await api.get<components["schemas"]["AdminDisputesListResponse"]>("/api/v1/admin/disputes", { params });
  return {
    disputes: data.disputes ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function patchAdminDispute(
  disputeId: string,
  body: components["schemas"]["AdminDisputePatchBody"],
): Promise<AdminDisputeCase> {
  const { data } = await api.patch<AdminDisputeCase>(`/api/v1/admin/disputes/${disputeId}`, body);
  return data;
}

export type AdminReviewRow = components["schemas"]["AdminReviewRow"];

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
  const { data } = await api.get<components["schemas"]["AdminReviewsListResponse"]>("/api/v1/admin/reviews", { params });
  return { reviews: data.reviews ?? [], total: data.total ?? 0 };
}

export async function fetchAdminReview(reviewId: string): Promise<AdminReviewRow> {
  const { data } = await api.get<components["schemas"]["AdminReviewDetailResponse"]>(
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

export type AdminChatMessageItem = components["schemas"]["AdminChatMessageItem"];

export type AdminChatConversationPayload = Omit<components["schemas"]["AdminConversationMessagesResponse"], "success">;

export async function fetchAdminChatMessages(
  conversationId: string,
): Promise<AdminChatConversationPayload> {
  const { data } = await api.get<components["schemas"]["AdminConversationMessagesResponse"]>(
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
