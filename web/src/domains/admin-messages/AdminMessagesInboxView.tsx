"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  formatDateTime,
} from "@/capabilities/admin-shell";
import { useSession } from "@/foundation/session";
import { isPlatformError } from "@/foundation/platform-client";
import {
  fetchAdminConversationMessages,
  fetchAdminConversations,
  markAdminConversationRead,
  replyToAdminConversation,
  type AdminSupportConversationRow,
  type AdminSupportMessageRow,
} from "@/domains/admin-messages/api";

/**
 * Support inbox tab: a conversation list on the left, the open thread and a
 * reply box on the right. Matches the baseline's two-pane layout, minus the
 * rich-text editor (plain textarea — Tiptap is not available without a new
 * dependency).
 */
export function AdminMessagesInboxView() {
  const { session } = useSession();
  const ownUserId = session?.user.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AdminSupportConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessageRow[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);

  // A silent refresh (after sending a reply) that never flips `loading`,
  // so the effect below — which does need to show a spinner on first
  // mount — can stay a plain promise chain instead of calling this.
  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await fetchAdminConversations());
    } catch {
      // best-effort: the visible list simply stays as it was
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminConversations()
      .then((rows) => {
        if (!cancelled) setConversations(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(isPlatformError(cause) ? cause.detail : "Could not load support threads.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setReplyDraft("");
    try {
      setMessages(await fetchAdminConversationMessages(conversationId));
      await markAdminConversationRead(conversationId);
      setConversations((current) =>
        current.map((row) => (row.id === conversationId ? { ...row, unread_count: 0 } : row)),
      );
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load this thread.");
    }
  }

  async function sendReply() {
    if (!activeConversationId || !replyDraft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await replyToAdminConversation(activeConversationId, replyDraft.trim());
      setMessages((current) => [...current, message]);
      setReplyDraft("");
      void refreshConversations();
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not send this reply.");
    } finally {
      setSending(false);
    }
  }

  const activeConversation = conversations.find((row) => row.id === activeConversationId) ?? null;

  if (loading) return <AdminLoadingState label="Loading support threads…" />;

  return (
    <div className="space-y-3">
      {error ? <AdminErrorBanner message={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-2xl border border-primary-border bg-white">
          <div className="border-b border-primary-border px-4 py-3 text-sm font-medium text-neutral-800">
            Support threads
          </div>
          {conversations.length === 0 ? (
            <AdminEmptyState title="No support threads yet" />
          ) : (
            <ul className="max-h-[32rem] divide-y divide-primary-border overflow-y-auto">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-primary-soft/40 ${
                      activeConversationId === conversation.id ? "bg-primary-soft/40" : ""
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-neutral-900">
                        {conversation.peer_display_name}
                      </span>
                      {conversation.unread_count > 0 ? (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {conversation.unread_count}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {conversation.last_message_at ? formatDateTime(conversation.last_message_at) : "No messages"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[24rem] flex-col rounded-2xl border border-primary-border bg-white">
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
              Select a thread to read and reply.
            </div>
          ) : (
            <>
              <div className="border-b border-primary-border px-4 py-3 text-sm font-medium text-neutral-900">
                {activeConversation.peer_display_name}
              </div>
              <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((message) => {
                  const sentByStaff = message.sender_user_id === ownUserId;
                  return (
                    <li key={message.id} className={`flex ${sentByStaff ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          sentByStaff ? "bg-primary-soft text-neutral-900" : "bg-neutral-100 text-neutral-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className="mt-1 text-[10px] text-neutral-500">
                          {message.created_at ? formatDateTime(message.created_at) : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex gap-2 border-t border-primary-border p-3">
                <textarea
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Reply as Eventtz Support…"
                  rows={2}
                  className="flex-1 rounded-xl border border-primary-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={!replyDraft.trim() || sending}
                  className="self-end rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
