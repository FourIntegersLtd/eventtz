import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminMessageAudience = NonNullable<
  components["schemas"]["AdminMessageSendBody"]["audience"]
>;

export type AdminMessageSendBody = components["schemas"]["AdminMessageSendBody"];

export type AdminMessageSendResult = components["schemas"]["AdminMessageSendResponse"];

export type AdminSupportConversation = components["schemas"]["AdminSupportConversationRow"];

export type AdminSupportMessage = components["schemas"]["AdminSupportMessageRow"];

function prefix() {
  return "/api/v1/admin/messages";
}

export async function sendAdminMessages(body: AdminMessageSendBody): Promise<AdminMessageSendResult> {
  const { data } = await api.post<AdminMessageSendResult>(`${prefix()}/send`, body);
  return data;
}

export const ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

/** Unread support messages across every thread, summed in SQL (the staff Messages badge). */
export async function fetchAdminUnreadCount(): Promise<number> {
  const { data } = await api.get<components["schemas"]["ChatUnreadCountResponse"]>(
    `${prefix()}/unread-count`,
  );
  return data.unread_count ?? 0;
}

export async function fetchAdminSupportConversationsPage(
  offset = 0,
  limit = ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE,
): Promise<{
  conversations: AdminSupportConversation[];
  total: number;
  offset: number;
  limit: number;
}> {
  const { data } = await api.get<
    components["schemas"]["AdminSupportConversationsListResponse"]
  >(`${prefix()}/conversations`, { params: { offset, limit } });
  return {
    conversations: data.conversations ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function fetchAdminSupportMessages(
  conversationId: string,
): Promise<AdminSupportMessage[]> {
  const { data } = await api.get<components["schemas"]["AdminSupportMessagesListResponse"]>(
    `${prefix()}/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
  return data.messages ?? [];
}

export async function postAdminSupportMessage(
  conversationId: string,
  body: string,
): Promise<AdminSupportMessage> {
  const { data } = await api.post<components["schemas"]["AdminSupportMessageCreateResponse"]>(
    `${prefix()}/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body },
  );
  return data.message;
}

export async function patchAdminSupportMessage(
  conversationId: string,
  messageId: string,
  body: string,
): Promise<AdminSupportMessage> {
  const { data } = await api.patch<components["schemas"]["AdminSupportMessageEditResponse"]>(
    `${prefix()}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { body },
  );
  return data.message;
}

export async function postAdminSupportConversationRead(conversationId: string): Promise<void> {
  await api.post(`${prefix()}/conversations/${encodeURIComponent(conversationId)}/read`);
}
