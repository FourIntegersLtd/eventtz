"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchConversation, fetchMessages, markConversationRead, sendMessage, type ConversationRow, type MessageRow } from "@/domains/vendor-help/api";
import { formatSupportMessageTime } from "@/domains/vendor-help/helpFormatting";

/** One thread, embedded in the Help page's Messages tab. */
export function SupportThreadView({ conversationId, backHref }: { conversationId: string; backHref: string }) {
  const { session } = useSession();
  const myUserId = session?.user.id ?? "";
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    try {
      const [conversationRow, messageRows] = await Promise.all([fetchConversation(conversationId), fetchMessages(conversationId)]);
      setConversation(conversationRow);
      setMessages(messageRows);
      await markConversationRead(conversationId).catch(() => undefined);
    } catch {
      setError("Could not load this conversation.");
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

  useRealtimeStream(["chat_unread_changed"], () => {
    void fetchMessages(conversationId).then(setMessages).catch(() => undefined);
  });

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
    } catch {
      setError("Could not send that message.");
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

  const peerName = conversation?.peer_display_name?.trim() || "Conversation";

  return (
    <div className="flex h-full min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <Link href={backHref} className="text-sm text-neutral-500 hover:underline md:hidden">
          ← Back
        </Link>
        <p className="truncate text-base font-semibold text-neutral-900">{peerName}</p>
      </div>

      {error ? <p className="mx-5 mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-neutral-50/60 px-5 py-5">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-neutral-500">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_user_id === myUserId;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-primary/10 text-neutral-900" : "bg-white text-neutral-900 ring-1 ring-neutral-200"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={`mt-1.5 text-[11px] tabular-nums ${mine ? "text-primary/60" : "text-neutral-400"}`}>
                    {formatSupportMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-3 border-t border-neutral-100 px-5 py-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 5000))}
          rows={2}
          placeholder="Type a message…"
          aria-label="Message"
          disabled={sending}
          className="min-h-[56px] w-full min-w-0 flex-1 resize-none rounded-xl bg-neutral-50 px-4 py-3 text-sm ring-1 ring-neutral-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || sending} loading={sending} className="shrink-0">
          Send
        </Button>
      </div>
    </div>
  );
}
