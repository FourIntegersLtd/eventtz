"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/components/admin-shell/adminTheme";
import {
  emptySupportDraft,
  isSupportDraftValid,
  SupportMessageComposer,
} from "@/features/admin/messages/SupportMessageComposer";
import type { SupportRichTextChange } from "@/features/admin/messages/SupportRichTextEditor";
import { isHtmlMessage, MessageBody } from "@/lib/renderMessageBody";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchAdminSupportConversations,
  fetchAdminSupportMessages,
  patchAdminSupportMessage,
  postAdminSupportConversationRead,
  postAdminSupportMessage,
  type AdminSupportConversation,
  type AdminSupportMessage,
} from "@/lib/adminMessagesApi";
import { CHAT_UNREAD_CLEARED_EVENT } from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

const STAFF_BUBBLE =
  "rounded-2xl rounded-br-md bg-primary-muted text-neutral-900 ring-1 ring-primary/10";
const STAFF_EDIT_PANEL =
  "w-full rounded-2xl bg-primary-muted px-4 py-3 text-sm text-neutral-900 ring-1 ring-primary/15";

type AdminMessagesInboxViewProps = {
  /** Fired when conversation list unread totals change (for tab badge). */
  onUnreadTotalChange?: (total: number) => void;
};

function messageEditedAt(m: AdminSupportMessage): string | null {
  const meta = m.metadata;
  if (!meta || typeof meta !== "object") return null;
  const edited = (meta as { edited_at?: unknown }).edited_at;
  return typeof edited === "string" && edited.trim() ? edited : null;
}

export function AdminMessagesInboxView({ onUnreadTotalChange }: AdminMessagesInboxViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const adminId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [threadDraft, setThreadDraft] = useState<SupportRichTextChange>(emptySupportDraft());
  const [threadComposerKey, setThreadComposerKey] = useState(0);
  const [threadSending, setThreadSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SupportRichTextChange>(emptySupportDraft());
  const [editComposerKey, setEditComposerKey] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

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

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptySupportDraft());
  };

  const openThread = async (id: string) => {
    setActiveId(id);
    setThreadDraft(emptySupportDraft());
    setThreadComposerKey((k) => k + 1);
    cancelEdit();
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
    if (!activeId || !isSupportDraftValid(threadDraft.textLength) || threadSending) return;
    setThreadSending(true);
    setError(null);
    try {
      const msg = await postAdminSupportMessage(activeId, threadDraft.html);
      setMessages((prev) => [...prev, msg]);
      setThreadDraft(emptySupportDraft());
      setThreadComposerKey((k) => k + 1);
      showToast({ title: "Reply sent", tone: "success" });
      void loadInbox({ silent: true });
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not send reply.";
      setError(message);
      showToast({ title: "Reply not sent", description: message, tone: "error" });
    } finally {
      setThreadSending(false);
    }
  };

  const saveEdit = async () => {
    if (!activeId || !editingId || !isSupportDraftValid(editDraft.textLength) || editSaving) return;
    setEditSaving(true);
    setError(null);
    try {
      const updated = await patchAdminSupportMessage(activeId, editingId, editDraft.html);
      setMessages((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      cancelEdit();
      showToast({ title: "Message updated", tone: "success" });
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not save edit.";
      setError(message);
      showToast({ title: "Edit not saved", description: message, tone: "error" });
    } finally {
      setEditSaving(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:min-h-[calc(100dvh-10rem)]">
      <div className={`${adminCard} flex max-h-[38dvh] flex-col overflow-hidden lg:max-h-none lg:min-h-0`}>
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800">
          Support threads
        </div>
        {loading ? (
          <div className="p-4">
            <AdminLoadingState label="Loading…" />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            variant="support"
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

      <div className={`${adminCard} flex min-h-[min(100dvh-14rem,100%)] flex-1 flex-col overflow-hidden lg:min-h-0`}>
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
                const ownMessage = m.sender_user_id === adminId;
                const isEditing = editingId === m.id;
                const editedAt = messageEditedAt(m);

                return (
                  <li
                    key={m.id}
                    className={`flex w-full ${isEditing ? "" : staff ? "justify-end" : "justify-start"}`}
                  >
                    {isEditing ? (
                      <div className={STAFF_EDIT_PANEL}>
                        <SupportMessageComposer
                          key={editComposerKey}
                          html={editDraft.html}
                          textLength={editDraft.textLength}
                          initialHtml={m.body}
                          onChange={setEditDraft}
                          onSend={() => void saveEdit()}
                          loading={editSaving}
                          showSendButton={false}
                          minHeightClass="min-h-[8rem]"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving}>
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={editSaving}
                            disabled={!isSupportDraftValid(editDraft.textLength)}
                            onClick={() => void saveEdit()}
                          >
                            Save changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`group relative max-w-[85%] px-3 py-2 text-sm ${
                          staff ? STAFF_BUBBLE : "rounded-2xl bg-neutral-100 text-neutral-900"
                        }`}
                      >
                        {ownMessage ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditDraft({ html: m.body, textLength: 0 });
                              setEditComposerKey((k) => k + 1);
                            }}
                            className="absolute right-2 top-2 rounded p-1 text-neutral-400 opacity-0 transition hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                            aria-label="Edit message"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                        <MessageBody
                          body={m.body}
                          metadata={m.metadata}
                          className={`break-words ${ownMessage ? "pr-6" : ""} ${
                            isHtmlMessage(m.metadata) ? "" : "whitespace-pre-wrap"
                          }`}
                        />
                        <p className="mt-1 text-[10px] tabular-nums text-neutral-500">
                          {m.created_at ? formatDateTime(m.created_at) : ""}
                          {editedAt ? " · Edited" : ""}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-neutral-100 px-4 py-3">
              {editingId ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                  <span>Editing a message. Save or cancel above.</span>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
                    aria-label="Cancel edit"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <SupportMessageComposer
                  key={threadComposerKey}
                  html={threadDraft.html}
                  textLength={threadDraft.textLength}
                  onChange={setThreadDraft}
                  onSend={() => void reply()}
                  loading={threadSending}
                  placeholder="Reply as Eventtz Support…"
                  minHeightClass="min-h-[4.5rem]"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
