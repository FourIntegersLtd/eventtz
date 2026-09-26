"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchConversations, type ConversationRow } from "@/domains/vendor-help/api";
import { SupportThreadView } from "@/domains/vendor-help/SupportThreadView";

const MESSAGES_BASE_PATH = "/vendor/help/messages";

/**
 * The Help page's Messages tab: the same inbox the standalone Messages page
 * shows (support threads included), presented here so a vendor can reach
 * their conversations without leaving Help. Master-detail on desktop, one
 * pane at a time on mobile — matching the baseline's `ChatPortalView`.
 */
export function SupportMessagesView({ selectedConversationId }: { selectedConversationId?: string }) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const rows = await fetchConversations();
      setConversations(rows);
      setError(null);
    } catch {
      setError("Could not load messages.");
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

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className={selectedConversationId ? "hidden md:block" : ""}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading…" />
          </div>
        ) : error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-5 py-10 text-center text-sm text-neutral-500">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`${MESSAGES_BASE_PATH}/${encodeURIComponent(conversation.id)}`}
                  aria-current={selectedConversationId === conversation.id}
                  className={`block px-4 py-3 text-sm transition ${
                    selectedConversationId === conversation.id ? "bg-primary/[0.05]" : "hover:bg-neutral-50"
                  }`}
                >
                  <p className={`truncate ${conversation.unread_count > 0 ? "font-semibold text-neutral-900" : "font-medium text-neutral-800"}`}>
                    {conversation.peer_display_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {conversation.kind === "support" ? "Eventtz Support" : "Client conversation"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={selectedConversationId ? "" : "hidden md:block"}>
        {selectedConversationId ? (
          <SupportThreadView conversationId={selectedConversationId} backHref={MESSAGES_BASE_PATH} />
        ) : (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-2xl border border-neutral-100 bg-white text-sm text-neutral-500">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}
