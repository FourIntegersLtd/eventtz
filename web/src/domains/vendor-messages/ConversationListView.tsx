"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { hasCode } from "@/foundation/platform-client";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchConversations, type ConversationRow } from "@/domains/vendor-messages/api";
import { formatConversationActivity, formatUnreadBadge, peerInitials } from "@/domains/vendor-messages/messageFormatting";

interface ConversationListViewProps {
  /** Currently open thread, if any — highlights that row. */
  selectedConversationId?: string;
  /** Where a row links to: `${basePath}/${conversation.id}`. */
  basePath: string;
}

/**
 * The vendor's chat inbox: every thread with a client, newest activity
 * first, plus any support thread. Refetches live when a `chat_unread_changed`
 * frame arrives on the realtime stream.
 */
export function ConversationListView({ selectedConversationId, basePath }: ConversationListViewProps) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const rows = await fetchConversations();
      setConversations(rows);
      setError(null);
    } catch (cause) {
      setError(hasCode(cause, "unauthenticated") ? "Sign in to see your messages." : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Dedupe concurrent callers (mount + a realtime refresh landing at once)
  // behind one in-flight promise — the same shape as `VendorPaymentsView`'s
  // `refreshStatus`/`loadStatus` split.
  const loadInFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    loadInFlight.current ??= loadConversations().finally(() => {
      loadInFlight.current = null;
    });
    return loadInFlight.current;
  }, [loadConversations]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeStream(["chat_unread_changed"], () => void load());

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 px-5 py-10 text-center text-sm text-neutral-500">
        No conversations yet. When a client messages you, it will show up here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      {conversations.map((conversation) => {
        const unread = conversation.unread_count > 0;
        const selected = selectedConversationId === conversation.id;
        const when = formatConversationActivity(conversation.last_message_at ?? conversation.created_at);
        return (
          <li key={conversation.id}>
            <Link
              href={`${basePath}/${encodeURIComponent(conversation.id)}`}
              aria-current={selected}
              className={`flex items-start gap-3.5 px-5 py-4 transition ${
                selected ? "bg-primary/[0.05]" : unread ? "bg-primary/[0.03] hover:bg-primary/[0.05]" : "hover:bg-neutral-50"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  unread ? "bg-primary/15 text-primary" : "bg-neutral-100 text-neutral-600"
                }`}
                aria-hidden
              >
                {peerInitials(conversation.peer_display_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 truncate text-sm text-neutral-900 ${unread ? "font-semibold" : "font-medium"}`}>
                    {conversation.peer_display_name}
                  </span>
                  {when ? (
                    <span className={`shrink-0 text-xs tabular-nums ${unread ? "font-medium text-primary" : "text-neutral-400"}`}>
                      {when}
                    </span>
                  ) : null}
                </span>
                <span className={`mt-1 block truncate text-sm ${unread ? "font-medium text-neutral-700" : "text-neutral-500"}`}>
                  {unread
                    ? `${conversation.unread_count} unread message${conversation.unread_count === 1 ? "" : "s"}`
                    : conversation.kind === "support"
                      ? "Eventtz Support"
                      : "Client conversation"}
                </span>
              </span>
              {unread ? (
                <span className="mt-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-white">
                  {formatUnreadBadge(conversation.unread_count)}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
