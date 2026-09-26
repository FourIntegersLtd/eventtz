/**
 * The vendor-messages domain's requests against the platform API's shared
 * chat namespace (`/api/v1/chat/*` — not `/vendor/*`, because a chat thread
 * has one client party and one vendor party and the same endpoints serve
 * both portals; see `api/openapi.json`).
 */
import { platformRequest, type components } from "@/foundation/platform-client";

export type ConversationRow = components["schemas"]["ConversationRow"];
export type MessageRow = components["schemas"]["MessageRow"];

/** The caller's threads, newest activity first. */
export function fetchConversations(): Promise<ConversationRow[]> {
  return platformRequest<components["schemas"]["ConversationsListResponse"]>("/api/v1/chat/conversations").then(
    (response) => response.conversations,
  );
}

/** One thread's metadata (peer name, unread count). */
export function fetchConversation(conversationId: string): Promise<ConversationRow> {
  return platformRequest<components["schemas"]["ConversationDetailResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`,
  ).then((response) => response.conversation);
}

/** A thread's messages, oldest first. */
export function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  return platformRequest<components["schemas"]["MessagesListResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  ).then((response) => response.messages);
}

/** Send a message on a thread. */
export function sendMessage(conversationId: string, body: string): Promise<MessageRow> {
  return platformRequest<components["schemas"]["MessageCreateResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: { body } },
  ).then((response) => response.message);
}

/** Mark a thread's messages read, for the unread badge to clear. */
export function markConversationRead(conversationId: string): Promise<void> {
  return platformRequest<void>(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}
