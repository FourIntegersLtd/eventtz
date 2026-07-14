import api from "@/lib/axios";

export type AdminMessageAudience = "clients" | "vendors" | "users";

export type AdminMessageSendBody = {
  body: string;
  audience?: AdminMessageAudience;
  recipient_user_ids?: string[];
};

export type AdminMessageSendResult = {
  success: boolean;
  sent: number;
  conversation_ids: string[];
  failures?: { user_id: string; error: string }[] | null;
};

export type AdminSupportConversation = {
  id: string;
  kind: "support";
  support_user_id: string;
  peer_user_id: string;
  peer_display_name: string;
  created_at: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type AdminSupportMessage = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

function prefix() {
  return "/api/v1/admin/messages";
}

export async function sendAdminMessages(body: AdminMessageSendBody): Promise<AdminMessageSendResult> {
  const { data } = await api.post<AdminMessageSendResult>(`${prefix()}/send`, body);
  return data;
}

export async function fetchAdminSupportConversations(): Promise<AdminSupportConversation[]> {
  const { data } = await api.get<{ conversations: AdminSupportConversation[] }>(
    `${prefix()}/conversations`,
  );
  return data.conversations ?? [];
}

export async function fetchAdminSupportMessages(
  conversationId: string,
): Promise<AdminSupportMessage[]> {
  const { data } = await api.get<{ messages: AdminSupportMessage[] }>(
    `${prefix()}/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
  return data.messages ?? [];
}

export async function postAdminSupportMessage(
  conversationId: string,
  body: string,
): Promise<AdminSupportMessage> {
  const { data } = await api.post<{ message: AdminSupportMessage }>(
    `${prefix()}/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body },
  );
  return data.message;
}

export async function postAdminSupportConversationRead(conversationId: string): Promise<void> {
  await api.post(`${prefix()}/conversations/${encodeURIComponent(conversationId)}/read`);
}
