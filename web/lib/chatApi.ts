import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type ChatConversation = components["schemas"]["ConversationRow"];

export type ChatQuoteMetadata = {
  kind: "quote";
  booking_request_id: string;
  event_name: string;
  total_label: string;
};

/**
 * `metadata` is a free-form dict in the API schema; the thread view narrows it to a quote card
 * (`ChatQuoteMetadata`) when `kind === "quote"`.
 */
export type ChatMessage = WithFields<
  components["schemas"]["MessageRow"],
  {
    /** Present for system cards (e.g. a sent quote) - render a rich card instead of plain text. */
    metadata: ChatQuoteMetadata | Record<string, unknown> | null;
  }
>;

function chatPrefix() {
  return "/api/v1/chat";
}

export async function fetchChatUnreadCount(): Promise<number> {
  const { data } = await api.get<components["schemas"]["ChatUnreadCountResponse"]>(
    `${chatPrefix()}/unread-count`,
  );
  return data.unread_count ?? 0;
}

export const CHAT_CONVERSATIONS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export type ChatConversationsPage = {
  conversations: ChatConversation[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchConversationsPage(
  offset = 0,
  limit = CHAT_CONVERSATIONS_PAGE_SIZE,
  kind?: "dm" | "support",
): Promise<ChatConversationsPage> {
  const { data } = await api.get<components["schemas"]["ConversationsListResponse"]>(`${chatPrefix()}/conversations`, {
    params: {
      offset,
      limit,
      ...(kind ? { kind } : {}),
    },
  });
  return {
    conversations: data.conversations ?? [],
    total: data.total ?? data.conversations?.length ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

/** Loads the first page of every conversation (prefer `fetchConversationsPage` for large inboxes). */
export async function fetchConversations(): Promise<ChatConversation[]> {
  const page = await fetchConversationsPage(0, 200);
  return page.conversations;
}

export async function postConversation(peerUserId: string): Promise<ChatConversation> {
  const { data } = await api.post<components["schemas"]["ConversationCreateResponse"]>(
    `${chatPrefix()}/conversations`,
    { peer_user_id: peerUserId } satisfies components["schemas"]["ConversationCreateBodyShared"],
  );
  return data.conversation;
}

export async function fetchConversation(conversationId: string): Promise<ChatConversation> {
  const { data } = await api.get<components["schemas"]["ConversationDetailResponse"]>(
    `${chatPrefix()}/conversations/${conversationId}`,
  );
  return data.conversation;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<components["schemas"]["MessagesListResponse"]>(
    `${chatPrefix()}/conversations/${conversationId}/messages`,
  );
  return data.messages ?? [];
}

export async function postMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data } = await api.post<components["schemas"]["MessageCreateResponse"]>(
    `${chatPrefix()}/conversations/${conversationId}/messages`,
    { body } satisfies components["schemas"]["MessageCreateBody"],
  );
  return data.message;
}

export async function postConversationRead(conversationId: string): Promise<void> {
  await api.post(`${chatPrefix()}/conversations/${conversationId}/read`);
}

/** Fired after marking chat read so the sidebar badge can refresh. */
export const CHAT_UNREAD_CLEARED_EVENT = "eventtz:chat-unread-refresh";
/** Fired when chat data should refresh (SSE). Used by inbox/thread without causing loops. */
export const CHAT_REFRESH_EVENT = "eventtz:chat-refresh";
