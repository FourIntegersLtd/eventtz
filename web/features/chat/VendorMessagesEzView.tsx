"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useServerList } from "@/lib/useServerList";
import { ChatThreadView } from "@/features/chat/ChatThreadView";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { TablePagination } from "@/components/ui/TablePagination";
import {
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
  const [draftBookingId, setDraftBookingId] = useState<string | null>(null);

  const list = useServerList<ChatConversation>({
    filters: {},
    errorMessage: "Could not load messages.",
    fetchPage: async ({ offset, limit }) => {
      const page = await fetchConversationsPage(offset, limit);
      return { items: page.conversations, total: page.total };
    },
  });
  const rows = list.items;
  const { reload } = list;

  useRealtimeRefresh("chat:data_refresh", reload, [reload]);

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
    <div className="ez-stack ez-stack--lg min-h-0 flex-1 overflow-auto">
      <PageHeader descriptionSize="body"
        eyebrow="Work"
        title="Messages"
        description="Chat with clients about their events."
      />

      <div className="ez-split">
        <div className="ez-split__main">
          {selectedConversationId ? (
            <Card>
              <CardHeader>
                <div className="ez-hrow">
                  <span className="ez-avatar">{initials(selected?.peer_display_name ?? "Client")}</span>
                  <div>
                    <div className="ez-strong">{selected?.peer_display_name ?? "Conversation"}</div>
                    <div className="ez-caption">{selected?.kind === "support" ? "Eventtz Support" : "Client"}</div>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="min-h-[420px]">
                <ChatThreadView
                  portal="vendor"
                  conversationId={selectedConversationId}
                  backHref="/vendor/messages"
                  backLabel="All messages"
                />
              </CardBody>
            </Card>
          ) : (
            <EmptyState title={rows.length === 0 ? "No conversations yet" : "Select a conversation"} variant="messages" />
          )}
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <Card>
            <CardBody>
              {list.loading && rows.length === 0 ? (
                <LoadingState label="Loading conversations…" variant="inline" />
              ) : list.error ? (
                <LottieFailureInline message={list.error} />
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
                    {row.unread_count > 0 ? <Badge tone="warning">{row.unread_count}</Badge> : null}
                  </Link>
                ))}
                {list.total > list.limit ? (
                  <TablePagination
                    offset={list.offset}
                    limit={list.limit}
                    total={list.total}
                    pageRowCount={rows.length}
                    loading={list.loading}
                    onPrevious={list.goPrevious}
                    onNext={list.goNext}
                  />
                ) : null}
                </>
              )}
            </CardBody>
          </Card>

          {draftBookingId ? (
            <Card>
              <CardHeader>
                <span className="ez-h3">Draft reply</span>
                <Badge tone="gold">Assistant</Badge>
              </CardHeader>
              <CardBody>
                <VendorDraftReplyPanel bookingId={draftBookingId} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
