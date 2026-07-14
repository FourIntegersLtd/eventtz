"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";
import { MessageComposer } from "@/features/chat/MessageComposer";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchAdminSupportConversations,
  fetchAdminSupportMessages,
  postAdminSupportConversationRead,
  postAdminSupportMessage,
  type AdminSupportConversation,
  type AdminSupportMessage,
} from "@/lib/adminMessagesApi";
import { CHAT_UNREAD_CLEARED_EVENT } from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

type AdminMessagesInboxViewProps = {
  /** Fired when conversation list unread totals change (for tab badge). */
  onUnreadTotalChange?: (total: number) => void;
};

export function AdminMessagesInboxView({ onUnreadTotalChange }: AdminMessagesInboxViewProps) {
  const { user } = useAuth();
  const adminId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [threadSending, setThreadSending] = useState(false);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0),
    [conversations],
  );

  useEffect(() => {
    onUnreadTotalChange?.(unreadTotal);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CLEARED_EVENT));
    }
  }, [unreadTotal, onUnreadTotalChange]);

  const loadInbox = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminSupportConversations();
      setConversations(list);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load support threads.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const refreshActiveMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const msgs = await fetchAdminSupportMessages(activeId);
      setMessages(msgs);
    } catch {
      /* best-effort */
    }
  }, [activeId]);

  const refreshAll = useCallback(() => {
    void loadInbox({ silent: true });
    void refreshActiveMessages();
  }, [loadInbox, refreshActiveMessages]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshAll]);

  useRealtimeRefresh("chat:data_refresh", refreshAll, [refreshAll]);

  const openThread = async (id: string) => {
    setActiveId(id);
    setThreadDraft("");
    try {
      const msgs = await fetchAdminSupportMessages(id);
      setMessages(msgs);
      await postAdminSupportConversationRead(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
      );
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load thread.");
    }
  };

  const reply = async () => {
    if (!activeId || !threadDraft.trim() || threadSending) return;
    setThreadSending(true);
    setError(null);
    try {
      const msg = await postAdminSupportMessage(activeId, threadDraft.trim());
      setMessages((prev) => [...prev, msg]);
      setThreadDraft("");
      void loadInbox({ silent: true });
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not send reply.");
    } finally {
      setThreadSending(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className={`${adminCard} flex max-h-[70vh] flex-col overflow-hidden`}>
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800">
          Support threads
        </div>
        {loading ? (
          <div className="p-4">
            <AdminLoadingState label="Loading…" />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" aria-hidden />}
            title="No support threads yet"
            description="Compose a message to open threads with clients or vendors."
            className="m-4"
          />
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-neutral-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void openThread(c.id)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 ${
                    activeId === c.id ? "bg-primary/[0.06]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-neutral-900">
                      {c.peer_display_name}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {c.unread_count}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {c.last_message_at ? formatDateTime(c.last_message_at) : "No messages"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${adminCard} flex min-h-[24rem] max-h-[70vh] flex-col`}>
        {error ? (
          <div className="p-4">
            <AdminErrorBanner message={error} />
          </div>
        ) : null}
        {!activeConv ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
            Select a thread to read and reply.
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="font-medium text-neutral-900">{activeConv.peer_display_name}</p>
            </div>
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => {
                const staff =
                  m.sender_user_id === adminId ||
                  (m.metadata && (m.metadata as { kind?: string }).kind === "admin");
                return (
                  <li key={m.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        staff ? "bg-primary text-white" : "bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`mt-1 text-[10px] tabular-nums ${
                          staff ? "text-white/70" : "text-neutral-500"
                        }`}
                      >
                        {m.created_at ? formatDateTime(m.created_at) : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-neutral-100 px-4 py-3">
              <MessageComposer
                value={threadDraft}
                onChange={setThreadDraft}
                onSend={() => void reply()}
                loading={threadSending}
                placeholder="Reply as Eventtz Support…"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
