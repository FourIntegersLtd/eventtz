"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchConversations, type ConversationRow } from "@/domains/messages/api";
import { ConversationListView } from "@/domains/messages/ConversationListView";
import { ConversationThreadView } from "@/domains/messages/ConversationThreadView";
import {
  EMPTY_INBOX_TITLE,
  LOAD_INBOX_FAILED,
  LOADING_CONVERSATIONS,
  SELECT_CONVERSATION_TITLE,
  type MessagePortal,
} from "@/domains/messages/messageRoutes";

interface InboxResult {
  conversations: ConversationRow[];
  error: string | null;
}

interface MessagesPortalViewProps {
  portal: MessagePortal;
  selectedConversationId?: string;
  /** Overrides the inbox root for row links and the thread's back link — the Help hub nests this under itself. */
  basePath?: string;
}

/**
 * Master-detail messages. Desktop (`lg`) shows the inbox and the open thread
 * side by side; narrower screens show one pane, and the thread carries its
 * own back link. Matches the baseline's `MasterDetailLayout` breakpoint.
 *
 * The inbox fetch lives here so the empty detail pane can say "Select a
 * conversation" once rows exist, and "No conversations yet" when they don't.
 * `loading` is derived from the result, so the effect never calls setState itself.
 */
export function MessagesPortalView({ portal, selectedConversationId, basePath }: MessagesPortalViewProps) {
  const [result, setResult] = useState<InboxResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasSelection = Boolean(selectedConversationId);
  const loading = result === null;
  const conversations = result?.conversations ?? [];

  useEffect(() => {
    let cancelled = false;
    fetchConversations()
      .then((rows) => {
        if (!cancelled) setResult({ conversations: rows, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ conversations: [], error: platformErrorDetail(cause) ?? LOAD_INBOX_FAILED });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useRealtimeStream(["chat_unread_changed"], () => setRefreshKey((current) => current + 1));

  const paneChildFill = "[&>*]:flex [&>*]:min-h-0 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:flex-col";

  return (
    <div className="flex h-full max-h-full min-h-0 flex-1 flex-col lg:flex-row lg:gap-8">
      <div className={`flex h-full min-h-0 min-w-0 flex-1 flex-col ${paneChildFill} lg:max-w-md ${hasSelection ? "hidden lg:flex" : ""}`}>
        <ConversationListView
          portal={portal}
          selectedConversationId={selectedConversationId}
          conversations={conversations}
          loading={loading}
          error={result?.error ?? null}
          basePath={basePath}
        />
      </div>
      <div className={`flex h-full min-h-0 min-w-0 flex-1 flex-col ${paneChildFill} ${hasSelection ? "" : "hidden lg:flex"}`}>
        {selectedConversationId ? (
          <ConversationThreadView
            key={selectedConversationId}
            portal={portal}
            conversationId={selectedConversationId}
            basePath={basePath}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-neutral-100 bg-white px-6 text-center">
            {loading ? (
              <LoadingState variant="inline" label={LOADING_CONVERSATIONS} />
            ) : (
              <p className="text-sm font-medium text-neutral-900">
                {conversations.length === 0 ? EMPTY_INBOX_TITLE : SELECT_CONVERSATION_TITLE}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
