"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { hasCode } from "@/foundation/platform-client";
import { useSession } from "@/foundation/session";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import {
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type ConversationRow,
  type MessageRow,
} from "@/domains/vendor-messages/api";
import { MessageComposer } from "@/domains/vendor-messages/MessageComposer";
import { formatMessageTime, groupMessagesByDay, peerInitials } from "@/domains/vendor-messages/messageFormatting";

interface ConversationThreadViewProps {
  conversationId: string;
  /** Where the back link returns to (the inbox list this thread was opened from). */
  backHref: string;
}

/** One chat thread: peer header, the day-grouped message history, and a composer. */
export function ConversationThreadView({ conversationId, backHref }: ConversationThreadViewProps) {
  const { session } = useSession();
  const myUserId = session?.user.id ?? "";
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    try {
      const [conversationRow, messageRows] = await Promise.all([
        fetchConversation(conversationId),
        fetchMessages(conversationId),
      ]);
      setConversation(conversationRow);
      setMessages(messageRows);
      setError(null);
      // Best-effort: a failed mark-read should not block showing the thread.
      await markConversationRead(conversationId).catch(() => undefined);
    } catch (cause) {
      setError(hasCode(cause, "conversation_not_found") ? "This conversation no longer exists." : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Dedupe concurrent callers (mount + a realtime refresh landing at once)
  // behind one in-flight promise — the same shape as `VendorPaymentsView`'s
  // `refreshStatus`/`loadStatus` split.
  const loadInFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    loadInFlight.current ??= loadThread().finally(() => {
      loadInFlight.current = null;
    });
    return loadInFlight.current;
  }, [loadThread]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeStream(
    ["chat_unread_changed"],
    () => {
      void fetchMessages(conversationId).then(setMessages).catch(() => undefined);
    },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(conversationId, body);
      setMessages((previous) => [...previous, message]);
      setDraft("");
      setError(null);
    } catch (cause) {
      setError(hasCode(cause, "message_too_long") ? "That message is too long." : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
          Back to messages
        </Link>
      </div>
    );
  }

  const peerName = conversation?.peer_display_name?.trim() || "Conversation";
  const dayGroups = groupMessagesByDay(messages);

  return (
    <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <Link href={backHref} className="text-sm text-neutral-500 hover:underline md:hidden">
          ← Back
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary" aria-hidden>
          {peerInitials(peerName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-neutral-900">{peerName}</p>
          <p className="text-sm text-neutral-500">
            {conversation?.kind === "support" ? "Messages with Eventtz Support" : "Chat with this client"}
          </p>
        </div>
      </div>

      {error ? <p className="mx-5 mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-neutral-50/60 px-5 py-5">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-neutral-500">No messages yet. Send the first one below.</p>
        ) : (
          dayGroups.map((group) => (
            <div key={group.label} className="space-y-2.5">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-neutral-400">{group.label}</p>
              {group.messages.map((message) => {
                const mine = message.sender_user_id === myUserId;
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        mine ? "rounded-br-md bg-primary/10 text-neutral-900" : "rounded-bl-md bg-white text-neutral-900 ring-1 ring-neutral-200"
                      }`}
                    >
                      {!mine && message.sender_display_name ? (
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                          {message.sender_display_name}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1.5 text-[11px] tabular-nums ${mine ? "text-primary/60" : "text-neutral-400"}`}>
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-100 px-5 py-4">
        <MessageComposer value={draft} onChange={setDraft} onSend={() => void handleSend()} sending={sending} />
      </div>
    </div>
  );
}
