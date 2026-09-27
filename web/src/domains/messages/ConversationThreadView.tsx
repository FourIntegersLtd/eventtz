"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { useSession } from "@/foundation/session";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import {
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type ConversationRow,
  type MessageRow,
} from "@/domains/messages/api";
import { MessageComposer } from "@/domains/messages/MessageComposer";
import { MessageBodyView } from "@/domains/messages/MessageBodyView";
import { validateMessageDraft } from "@/domains/messages/composerDraft";
import { formatBubbleTime, groupMessagesByDay, peerInitials } from "@/domains/messages/messageFormatting";
import { isHtmlMessage, quoteCardFromMetadata } from "@/domains/messages/messageBody";
import {
  BACK_TO_MESSAGES,
  EMPTY_THREAD_COPY,
  LOAD_THREAD_FAILED,
  LOADING_CONVERSATION,
  messagesPath,
  peerProfilePath,
  quoteBookingPath,
  SEND_FAILED,
  threadSubtitle,
  type MessagePortal,
} from "@/domains/messages/messageRoutes";

interface ConversationThreadViewProps {
  portal: MessagePortal;
  conversationId: string;
}

interface LoadedThread {
  conversationId: string;
  conversation: ConversationRow | null;
  error: string | null;
}

/**
 * One open thread: peer header, day-grouped history, and a composer.
 *
 * Marks the thread read when it opens and again when a refresh brings
 * messages in while it stays open. A failed send keeps the draft and shows
 * the error. `loading` is derived from the loaded conversation id.
 */
export function ConversationThreadView({ portal, conversationId }: ConversationThreadViewProps) {
  const { session } = useSession();
  const myUserId = session?.user.id ?? "";
  const [loaded, setLoaded] = useState<LoadedThread | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Last message-id list we have drawn. A refresh marks read only when this
  // changes after the thread is already open — marking read itself publishes
  // `chat_unread_changed`, so marking on every refresh would loop.
  const seenSignatureRef = useRef<string | null>(null);
  const backHref = messagesPath(portal);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchConversation(conversationId), fetchMessages(conversationId)])
      .then(([conversation, rows]) => {
        if (cancelled) return;
        seenSignatureRef.current = messageListSignature(rows);
        setLoaded({ conversationId, conversation, error: null });
        setMessages(rows);
        return markConversationRead(conversationId).catch(() => undefined);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoaded({
          conversationId,
          conversation: null,
          error: platformErrorDetail(cause) ?? LOAD_THREAD_FAILED,
        });
        setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const refreshOpenThread = useCallback(() => {
    void fetchMessages(conversationId)
      .then((rows) => {
        const signature = messageListSignature(rows);
        const arrivedWhileOpen = seenSignatureRef.current !== null && signature !== seenSignatureRef.current;
        seenSignatureRef.current = signature;
        setMessages(rows);
        if (arrivedWhileOpen) return markConversationRead(conversationId);
        return undefined;
      })
      .catch(() => undefined);
  }, [conversationId]);

  useRealtimeStream(["chat_unread_changed"], () => refreshOpenThread());

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshOpenThread();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshOpenThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (sendingRef.current) return;
    const parsed = validateMessageDraft(draft);
    if (!parsed.ok) {
      setBannerError(parsed.error);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setBannerError(null);
    try {
      const message = await sendMessage(conversationId, parsed.body);
      setMessages((previous) => [...previous, message]);
      const previousSignature = seenSignatureRef.current;
      seenSignatureRef.current = previousSignature === null ? message.id : `${previousSignature}\n${message.id}`;
      setDraft("");
    } catch (cause) {
      setBannerError(platformErrorDetail(cause) ?? SEND_FAILED);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const loading = loaded === null || loaded.conversationId !== conversationId;

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-2xl border border-neutral-100 bg-white px-5 py-8">
        <Spinner label={LOADING_CONVERSATION} />
      </div>
    );
  }

  if (!loaded?.conversation) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loaded?.error ?? LOAD_THREAD_FAILED}</p>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900">
          <ChevronLeftIcon />
          {BACK_TO_MESSAGES}
        </Link>
      </div>
    );
  }

  const conversation = loaded.conversation;
  const peerName = conversation.peer_display_name.trim() || "Conversation";
  const profileHref = peerProfilePath(portal, conversation.peer_user_id, conversation.kind);
  const dayGroups = groupMessagesByDay(messages);

  return (
    <div className="flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex min-w-0 shrink-0 flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 lg:hidden"
        >
          <ChevronLeftIcon />
          {BACK_TO_MESSAGES}
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
            aria-hidden
          >
            {peerInitials(peerName)}
          </span>
          <div className="min-w-0 flex-1">
            {profileHref ? (
              <Link href={profileHref} className="block truncate font-heading text-lg font-semibold text-neutral-900 hover:underline">
                {peerName}
              </Link>
            ) : (
              <p className="truncate font-heading text-lg font-semibold text-neutral-900">{peerName}</p>
            )}
            <p className="mt-0.5 text-sm leading-snug text-neutral-500">{threadSubtitle(portal, conversation.kind)}</p>
          </div>
        </div>
      </div>

      {bannerError ? (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 sm:mx-6">{bannerError}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-neutral-50/80 to-white px-5 py-5 sm:px-6 sm:py-6">
        {messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-neutral-500">{EMPTY_THREAD_COPY}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {dayGroups.map((group, groupIndex) => (
              <div key={`${group.label}-${groupIndex}`} className="flex flex-col gap-3.5">
                <p className="text-center text-xs font-medium uppercase tracking-wide text-neutral-400">{group.label}</p>
                <ul className="flex flex-col gap-3.5">
                  {group.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} mine={message.sender_user_id === myUserId} portal={portal} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-5 py-4 sm:px-6">
        <MessageComposer value={draft} onChange={setDraft} onSend={() => void handleSend()} sending={sending} />
      </div>
    </div>
  );
}

/** Ids joined so a refresh can tell "new messages" from the same list arriving again. */
function messageListSignature(rows: readonly { id: string }[]): string {
  return rows.map((row) => row.id).join("\n");
}

/** One row: a quote card, or an own/peer bubble with the sender and the time. */
function MessageBubble({ message, mine, portal }: { message: MessageRow; mine: boolean; portal: MessagePortal }) {
  const quote = quoteCardFromMetadata(message.metadata);
  if (quote) {
    return (
      <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <Link
          href={quoteBookingPath(portal, quote.bookingRequestId)}
          className="group flex w-full max-w-[85%] items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3.5 transition hover:border-primary/35 hover:bg-primary/[0.1] sm:max-w-[70%]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary/80">Custom quote</span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-neutral-900">{quote.eventName}</span>
            <span className="mt-0.5 block text-sm text-neutral-600">{quote.totalLabel} · View details</span>
          </span>
          <ChevronRightIcon />
        </Link>
      </li>
    );
  }

  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
          mine
            ? "rounded-br-md bg-primary-muted text-neutral-900 ring-1 ring-primary/10"
            : "rounded-bl-md bg-white text-neutral-900 ring-1 ring-neutral-200/70"
        }`}
      >
        {!mine && message.sender_display_name ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{message.sender_display_name}</p>
        ) : null}
        <MessageBodyView
          body={message.body}
          metadata={message.metadata}
          className={`break-words ${isHtmlMessage(message.metadata) ? "" : "whitespace-pre-wrap"}`}
        />
        <p className={`mt-1.5 text-[11px] tabular-nums ${mine ? "text-primary/55" : "text-neutral-400"}`}>
          {formatBubbleTime(message.created_at)}
        </p>
      </div>
    </li>
  );
}

/** Back control on the thread header and the load-error panel. Hidden on desktop by the caller. */
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Trailing mark on a quote card. */
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-primary/40 transition group-hover:text-primary" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
