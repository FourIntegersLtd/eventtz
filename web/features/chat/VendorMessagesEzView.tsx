"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatThreadView } from "@/features/chat/ChatThreadView";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  CHAT_CONVERSATIONS_PAGE_SIZE,
  fetchConversationsPage,
  type ChatConversation,
} from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { VendorDraftReplyPanel } from "@/features/vendor/copilot/VendorDraftReplyPanel";
import { fetchVendorBookingsPage } from "@/lib/vendorBookingsApi";

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type VendorMessagesEzViewProps = {
  selectedConversationId?: string;
};

/** Vendor messages (design V20): conversation list beside the existing thread. */
export function VendorMessagesEzView({ selectedConversationId }: VendorMessagesEzViewProps) {
  const [rows, setRows] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftBookingId, setDraftBookingId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchConversationsPage(offset, CHAT_CONVERSATIONS_PAGE_SIZE);
      setRows(page.conversations);
      setTotal(page.total);
    } catch {
      setError("Could not load messages.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("chat:data_refresh", () => void load(), [load]);

  useEffect(() => {
    if (!selectedConversationId) {
      setDraftBookingId(null);
      return;
    }
    let cancelled = false;
    void fetchVendorBookingsPage({
      group: "all",
      conversation_id: selectedConversationId,
      limit: 1,
    })
      .then((page) => {
        if (cancelled) return;
        setDraftBookingId(page.bookings[0]?.booking_request_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setDraftBookingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

  const selected = rows.find((row) => row.id === selectedConversationId) ?? null;

  return (
    <div className="ez-stack ez-stack--lg" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <PageHeader descriptionSize="body"
        eyebrow="Work"
        title="Messages"
        description="Chat with clients about their events."
      />

      <div className="ez-split">
        <div className="ez-split__main">
          {selectedConversationId ? (
            <div className="ez-card">
              <div className="ez-card__head">
                <div className="ez-hrow">
                  <span className="ez-avatar">{initials(selected?.peer_display_name ?? "Client")}</span>
                  <div>
                    <div className="ez-strong">{selected?.peer_display_name ?? "Conversation"}</div>
                    <div className="ez-caption">{selected?.kind === "support" ? "Eventtz Support" : "Client"}</div>
                  </div>
                </div>
              </div>
              <div className="ez-card__body" style={{ minHeight: 420 }}>
                <ChatThreadView
                  portal="vendor"
                  conversationId={selectedConversationId}
                  backHref="/vendor/messages"
                  backLabel="All messages"
                />
              </div>
            </div>
          ) : (
            <EmptyState title={rows.length === 0 ? "No conversations yet" : "Select a conversation"} variant="messages" />
          )}
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__body">
              {loading ? (
                <LoadingState label="Loading conversations…" variant="inline" />
              ) : error ? (
                <LottieFailureInline message={error} />
              ) : rows.length === 0 ? (
                <EmptyState className="border-0" variant="messages" title="No conversations yet" />
              ) : (
                <>
                {rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/vendor/messages/${row.id}`}
                    className={`ez-list-row${row.id === selectedConversationId ? " ez-list-row--active" : ""}`}
                  >
                    <span className="ez-avatar ez-avatar--sm">{initials(row.peer_display_name)}</span>
                    <div className="ez-list-row__main">
                      <span className="ez-strong">{row.peer_display_name}</span>
                      <span className="ez-small">
                        {row.unread_count > 0
                          ? `${row.unread_count} unread`
                          : row.kind === "support"
                            ? "Eventtz Support"
                            : "Client conversation"}
                      </span>
                    </div>
                    {row.unread_count > 0 ? <span className="ez-badge ez-badge--warning">{row.unread_count}</span> : null}
                  </Link>
                ))}
                {total > CHAT_CONVERSATIONS_PAGE_SIZE ? (
                  <TablePagination
                    offset={offset}
                    limit={CHAT_CONVERSATIONS_PAGE_SIZE}
                    total={total}
                    pageRowCount={rows.length}
                    onPrevious={() => setOffset(Math.max(0, offset - CHAT_CONVERSATIONS_PAGE_SIZE))}
                    onNext={() => setOffset(offset + CHAT_CONVERSATIONS_PAGE_SIZE)}
                  />
                ) : null}
                </>
              )}
            </div>
          </div>

          {draftBookingId ? (
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">Draft reply</span>
                <span className="ez-badge ez-badge--gold">Assistant</span>
              </div>
              <div className="ez-card__body">
                <VendorDraftReplyPanel bookingId={draftBookingId} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
