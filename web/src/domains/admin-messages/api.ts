import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminSupportConversationRow = components["schemas"]["AdminSupportConversationRow"];
export type AdminSupportMessageRow = components["schemas"]["AdminSupportMessageRow"];

/** The newest support threads. */
export async function fetchAdminConversations(limit = 50): Promise<AdminSupportConversationRow[]> {
  const response = await platformRequest<components["schemas"]["AdminSupportConversationsListResponse"]>(
    "/api/v1/admin/messages/conversations",
    { query: { limit } },
  );
  return response.conversations;
}

/** One support thread's messages, oldest first. */
export async function fetchAdminConversationMessages(conversationId: string): Promise<AdminSupportMessageRow[]> {
  const response = await platformRequest<components["schemas"]["AdminSupportMessagesListResponse"]>(
    `/api/v1/admin/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
  return response.messages;
}

/** Replies on a support thread; the user is emailed a copy. */
export async function replyToAdminConversation(conversationId: string, body: string): Promise<AdminSupportMessageRow> {
  const response = await platformRequest<components["schemas"]["AdminSupportMessageCreateResponse"]>(
    `/api/v1/admin/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: { body } },
  );
  return response.message;
}

/** Marks a support thread read for staff. */
export async function markAdminConversationRead(conversationId: string): Promise<void> {
  await platformRequest(`/api/v1/admin/messages/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}

/**
 * Sends a support message to named users, or (super admins only) to a whole
 * audience. The API itself enforces the super-admin-only broadcast rule;
 * the view also hides the audience option from plain admins, matching the
 * baseline's `canBroadcastMessages`.
 */
export async function sendAdminMessage(
  body: components["schemas"]["AdminMessageSendBody"],
): Promise<components["schemas"]["AdminMessageSendResponse"]> {
  return platformRequest<components["schemas"]["AdminMessageSendResponse"]>("/api/v1/admin/messages/send", {
    method: "POST",
    body,
  });
}
