"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import Link from "next/link";
import { ChevronRight, FileText, MessageSquare, Receipt } from "lucide-react";
import { CARD_SURFACE } from "@/components/ui/tokens";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import { EMPTY_STATE_ICON_CLASS } from "@/lib/emptyStateVariants";
import { MessageComposer } from "@/features/chat/MessageComposer";
import { isHtmlMessage, MessageBody } from "@/lib/renderMessageBody";
import { VendorQuoteFormModal } from "@/features/bookings/VendorQuoteFormModal";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";
import { CONVERSATION_LOAD_FAILED, SEND_MESSAGE_FAILED } from "@/lib/chat-messages";
import {
  CHAT_UNREAD_CLEARED_EVENT,
  type ChatConversation,
  type ChatMessage,
  type ChatQuoteMetadata,
  fetchConversation,
  fetchMessages,
  postConversationRead,
  postMessage,
} from "@/lib/chatApi";
import { fetchVendorBookingsPage } from "@/lib/vendorBookingsApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { chatBubbleClass } from "@/lib/chatBubbleClasses";
import { chatMessageSchema, parseForm } from "@/lib/validation";

type ChatThreadViewProps = {
  portal: "client" | "vendor";
  conversationId: string;
  backHref?: string;
  backLabel?: string;
  /** "page" (default) or "drawer" (no back link - Drawer chrome already has close). */
  variant?: "page" | "drawer";
  initialDraft?: string | null;
};

function formatBubbleTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatDateTime(iso);
}

function asQuoteMetadata(m: ChatMessage): ChatQuoteMetadata | null {
  const meta = m.metadata;
  if (!meta || typeof meta !== "object") return null;
  if ((meta as Record<string, unknown>).kind !== "quote") return null;
  const q = meta as unknown as ChatQuoteMetadata;
  return q.booking_request_id ? q : null;
}

function peerInitials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function ChatThreadView({
  portal,
  conversationId,
  backHref,
  backLabel = "Messages",
  variant = "page",
  initialDraft,
}: ChatThreadViewProps) {
  const isDrawer = variant === "drawer";
  const pageThreadShell = "h-full min-h-0 flex-1";
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [conv, setConv] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<{
    eventName?: string;
    eventDate?: string;
    eventEndDate?: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSupport = conv?.kind === "support";

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, m] = await Promise.all([
        fetchConversation(conversationId),
        fetchMessages(conversationId),
      ]);
      setConv(c);
      setMessages(m);
      try {
        await postConversationRead(conversationId);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CLEARED_EVENT));
        }
      } catch {
        /* Mark-read is best-effort - still show the thread if Supabase hiccups. */
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? CONVERSATION_LOAD_FAILED);
      setConv(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialDraft?.trim()) {
      setDraft(initialDraft.trim());
    }
  }, [conversationId, initialDraft]);

  useEffect(() => {
    if (!quoteOpen || portal !== "vendor" || !conversationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const byConversation = await fetchVendorBookingsPage({
          group: "active",
          conversation_id: conversationId,
          limit: 1,
        });
        const pendingPage = await fetchVendorBookingsPage({
          group: "active",
          status: "pending",
          limit: DEFAULT_LIST_PAGE_SIZE,
        });
        if (cancelled) return;
        const match =
          byConversation.bookings[0] ??
          pendingPage.bookings.find((b) => b.initiator === "client" && b.booking_status === "pending");
        if (match) {
          setQuotePrefill({
            eventName: match.event_name || undefined,
            eventDate: match.event_date?.slice(0, 10) || undefined,
            eventEndDate: match.event_end_date?.slice(0, 10) || undefined,
          });
        } else {
          setQuotePrefill(null);
        }
      } catch {
        if (!cancelled) setQuotePrefill(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteOpen, portal, conversationId]);

  const refreshMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const m = await fetchMessages(conversationId);
      setMessages(m);
    } catch {
      /* ignore */
    }
  }, [conversationId]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshMessages();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshMessages]);

  useRealtimeRefresh("chat:data_refresh", () => void refreshMessages(), [
    conversationId,
    refreshMessages,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (sending || !uid) return;
    const parsed = parseForm(chatMessageSchema, { body: draft });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const msg = await postMessage(conversationId, parsed.data.body);
      track(MixpanelEvents.chat_message_sent, {
        conversation_id: conversationId,
        portal,
      });
      setDraft("");
      setMessages((prev) => [...prev, msg]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CLEARED_EVENT));
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? SEND_MESSAGE_FAILED);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={`${CARD_SURFACE} px-5 py-8`}>
        <LoadingState label="Loading conversation…" variant="centered" className="py-4" branded />
      </div>
    );
  }

  if (error && !conv) {
    return (
      <div className="space-y-4">
        <LottieFailurePanel title="Couldn't load conversation" description={error} className="py-6" />
        {backHref ? (
          <BackLink href={backHref} label={backLabel} icon="chevron" tone="muted" />
        ) : null}
      </div>
    );
  }

  const peerName = conv?.peer_display_name?.trim() || "Conversation";
  const subtitle = isSupport
    ? "Messages with Eventtz Support"
    : portal === "vendor"
      ? "Chat with this client, or send a custom quote they can accept from Bookings"
      : "Messages with this vendor about your event";

  return (
    <div
      className={`flex max-h-full flex-col overflow-hidden ${CARD_SURFACE} ${
        isDrawer ? "h-full min-h-0 flex-1" : pageThreadShell
      }`}
    >
      <div className="flex min-w-0 shrink-0 flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-5">
        {backHref && !isDrawer ? (
          <BackLink
            href={backHref}
            label={backLabel}
            icon="chevron"
            tone="muted"
            mobileOnly
          />
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
            aria-hidden
          >
            {peerInitials(peerName)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-semibold text-ink">
              {peerName}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-ink-3">{subtitle}</p>
          </div>
        </div>

        {portal === "vendor" && conv && !isSupport ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText className="h-4 w-4" aria-hidden />}
            onClick={() => setQuoteOpen(true)}
            className="w-full shrink-0 sm:w-auto"
          >
            Send quote
          </Button>
        ) : null}
      </div>

      {portal === "vendor" && conv && !isSupport ? (
        <VendorQuoteFormModal
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          conversationId={conversationId}
          clientUserId={conv.client_user_id}
          quotePrefill={quotePrefill ?? undefined}
        />
      ) : null}

      {error ? (
        <div className="mx-5 mt-4 sm:mx-6">
          <LottieFailureInline message={error} />
        </div>
      ) : null}

      <div
        className={`scroll-pane flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-surface-3 to-white px-5 py-5 sm:px-6 sm:py-6`}
      >
        {messages.length === 0 ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-3 text-center">
            <MessageSquare className={EMPTY_STATE_ICON_CLASS} strokeWidth={1.75} aria-hidden />
            <p className="text-sm text-ink-3">No messages yet. Send the first one below.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {messages.map((m) => {
              const mine = m.sender_user_id === uid;
              const quote = asQuoteMetadata(m);
              if (quote) {
                const href =
                  portal === "vendor"
                    ? `/vendor/bookings/${encodeURIComponent(quote.booking_request_id)}`
                    : `/client/bookings/${encodeURIComponent(quote.booking_request_id)}`;
                return (
                  <MotionStaggerItem
                    key={m.id}
                    as="li"
                    stagger={false}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <Link
                      href={href}
                      className="group flex w-full max-w-[85%] items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3.5 transition hover:border-primary/35 hover:bg-primary/[0.1] sm:max-w-[70%]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Receipt className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                          Custom quote
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-ink">
                          {quote.event_name}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-2">
                          {quote.total_label} · View details
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-primary/40 transition group-hover:text-primary"
                        aria-hidden
                      />
                    </Link>
                  </MotionStaggerItem>
                );
              }
              return (
                <MotionStaggerItem
                  key={m.id}
                  as="li"
                  stagger={false}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className={`${chatBubbleClass(mine)} sm:max-w-[70%]`}>
                    {!mine && m.sender_display_name ? (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                        {m.sender_display_name}
                      </p>
                    ) : null}
                    <MessageBody
                      body={m.body}
                      metadata={m.metadata}
                      className={`break-words ${
                        isHtmlMessage(m.metadata) ? "" : "whitespace-pre-wrap"
                      }`}
                    />
                    <p className="ez-bubble-meta mt-1.5 text-[11px] tabular-nums">
                      {formatBubbleTime(m.created_at)}
                    </p>
                  </div>
                </MotionStaggerItem>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-line bg-white px-5 py-4 sm:px-6">
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={() => void send()}
          loading={sending}
          placeholder="Type a message…"
        />
      </div>
    </div>
  );
}
