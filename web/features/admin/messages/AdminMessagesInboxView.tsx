"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import {
  emptySupportDraft,
  isSupportDraftValid,
  SupportMessageComposer,
} from "@/features/admin/messages/SupportMessageComposer";
import type { SupportRichTextChange } from "@/features/admin/messages/SupportRichTextEditor";
import { isHtmlMessage, MessageBody } from "@/lib/renderMessageBody";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE,
  fetchAdminSupportConversationsPage,
  fetchAdminSupportMessages,
  patchAdminSupportMessage,
  postAdminSupportConversationRead,
  postAdminSupportMessage,
  type AdminSupportConversation,
  type AdminSupportMessage,
} from "@/lib/adminMessagesApi";
import { CHAT_UNREAD_CLEARED_EVENT } from "@/lib/chatApi";
import { CHAT_BUBBLE_MINE, chatBubbleClass } from "@/lib/chatBubbleClasses";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

const STAFF_EDIT_PANEL = `${CHAT_BUBBLE_MINE} w-full max-w-[85%]`;

function peerInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

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
  const [convOffset, setConvOffset] = useState(0);
  const [convTotal, setConvTotal] = useState(0);
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
      const page = await fetchAdminSupportConversationsPage(
        convOffset,
        ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE,
      );
      setConversations(page.conversations);
      setConvTotal(page.total);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load support threads.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [convOffset]);

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
    <div className="ez-split min-h-[min(100dvh-14rem,100%)]">
      <div
        className="ez-split__aside flex max-h-[42dvh] min-h-0 flex-col overflow-hidden lg:max-h-none"
        style={{ flex: "1 1 340px", maxWidth: 420 }}
      >
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
          <>
          <div className="ez-list min-h-0 flex-1 overflow-y-auto">
            {conversations.map((c) => {
              const unread = (c.unread_count || 0) > 0;
              const active = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void openThread(c.id)}
                  className={`ez-list-row w-full text-left ${active ? "ez-list-row--active" : ""} ${unread && !active ? "ez-list-row--unread" : ""}`}
                  style={{ flexWrap: "nowrap" }}
                >
                  <span className="ez-avatar ez-avatar--sm">{peerInitials(c.peer_display_name)}</span>
                  <div className="ez-list-row__main">
                    <span className="ez-strong truncate">{c.peer_display_name}</span>
                    <span className="ez-small">
                      {c.last_message_at ? "Support thread" : "No messages yet"}
                    </span>
                  </div>
                  {unread ? (
                    <span className="ez-caption ez-strong tabular-nums shrink-0">{c.unread_count}</span>
                  ) : c.last_message_at ? (
                    <span className="ez-caption shrink-0 whitespace-nowrap tabular-nums">
                      {formatDateTime(c.last_message_at)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <TablePagination
            offset={convOffset}
            limit={ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE}
            total={convTotal}
            loading={loading}
            onPrevious={() =>
              setConvOffset((current) =>
                Math.max(0, current - ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE),
              )
            }
            onNext={() => setConvOffset((current) => current + ADMIN_SUPPORT_CONVERSATIONS_PAGE_SIZE)}
          />
          </>
        )}
      </div>

      <div className="ez-split__main flex min-h-0 min-w-0 flex-1 flex-col">
        {error ? (
          <div className="mb-3">
            <AdminErrorBanner message={error} />
          </div>
        ) : null}
        {!activeConv ? (
          <div className="ez-card flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
            Select a thread to read and reply.
          </div>
        ) : (
          <section className="ez-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="ez-card__head">
              <h2 className="ez-h3">{activeConv.peer_display_name}</h2>
              {activeConv.unread_count > 0 ? (
                <span className="ez-badge ez-badge--brand">Open</span>
              ) : null}
            </div>

            <div className="ez-stack min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {activeConv.created_at ? (
                <span className="ez-system-msg">
                  Thread opened {formatDateTime(activeConv.created_at)} · {activeConv.peer_display_name}
                </span>
              ) : null}
              {messages.map((m) => {
                const staff =
                  m.sender_user_id === adminId ||
                  (m.metadata && (m.metadata as { kind?: string }).kind === "admin");
                const ownMessage = m.sender_user_id === adminId;
                const isEditing = editingId === m.id;
                const editedAt = messageEditedAt(m);

                if (isEditing) {
                  return (
                    <div key={m.id} className={STAFF_EDIT_PANEL}>
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
                  );
                }

                return (
                  <div key={m.id} className="ez-stack ez-stack--sm">
                    <div
                      className={`group relative ${chatBubbleClass(Boolean(staff))}`}
                    >
                      {ownMessage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditDraft({ html: m.body, textLength: 0 });
                            setEditComposerKey((k) => k + 1);
                          }}
                          className="absolute right-2 top-2 rounded p-1 text-neutral-400 opacity-0 transition hover:bg-neutral-900/5 group-hover:opacity-100"
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
                    </div>
                    <span
                      className={`ez-bubble-meta ${staff ? "self-end" : ""}`}
                    >
                      {staff ? "You" : activeConv.peer_display_name}
                      {m.created_at ? ` · ${formatDateTime(m.created_at)}` : ""}
                      {editedAt ? " · Edited" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className="ez-card__foot"
              style={{ justifyContent: "stretch", flexWrap: "nowrap" }}
            >
              {editingId ? (
                <div className="flex w-full items-center justify-between gap-2 text-sm text-neutral-600">
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
                <div className="ez-field min-w-0 flex-1">
                  <SupportMessageComposer
                    key={threadComposerKey}
                    html={threadDraft.html}
                    textLength={threadDraft.textLength}
                    onChange={setThreadDraft}
                    onSend={() => void reply()}
                    loading={threadSending}
                    placeholder="Write a reply"
                    minHeightClass="min-h-[4rem]"
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
