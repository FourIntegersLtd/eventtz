import api from "@/lib/axios";

export type ChatConversation = {
  id: string;
  client_user_id: string;
  vendor_user_id: string;
  peer_user_id: string;
  peer_display_name: string;
  created_at: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ChatQuoteMetadata = {
  kind: "quote";
  booking_request_id: string;
  event_name: string;
  total_label: string;
};

export type ChatMessage = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string | null;
  /** Present for system cards (e.g. a sent quote) — render a rich card instead of plain text. */
  metadata: ChatQuoteMetadata | Record<string, unknown> | null;
};

function chatPrefix() {
  return "/api/v1/chat";
}

export async function fetchChatUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread_count: number }>(
    `${chatPrefix()}/unread-count`,
  );
  return data.unread_count ?? 0;
}

export async function fetchConversations(): Promise<ChatConversation[]> {
  const { data } = await api.get<{ conversations: ChatConversation[] }>(
    `${chatPrefix()}/conversations`,
  );
  return data.conversations ?? [];
}

export async function postConversation(peerUserId: string): Promise<ChatConversation> {
  const { data } = await api.post<{ conversation: ChatConversation }>(
    `${chatPrefix()}/conversations`,
    { peer_user_id: peerUserId },
  );
  return data.conversation;
}

export async function fetchConversation(conversationId: string): Promise<ChatConversation> {
  const { data } = await api.get<{ conversation: ChatConversation }>(
    `${chatPrefix()}/conversations/${conversationId}`,
  );
  return data.conversation;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<{ messages: ChatMessage[] }>(
    `${chatPrefix()}/conversations/${conversationId}/messages`,
  );
  return data.messages ?? [];
}

export async function postMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data } = await api.post<{ message: ChatMessage }>(
    `${chatPrefix()}/conversations/${conversationId}/messages`,
    { body },
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
