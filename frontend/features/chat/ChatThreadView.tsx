"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Receipt, Send } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorQuoteFormModal } from "@/features/vendor/quotes/VendorQuoteFormModal";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";
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
import { fetchVendorBookings } from "@/lib/vendorBookingsApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

const MAX_LEN = 5000;

type ChatThreadViewProps = {
  portal: "client" | "vendor";
  conversationId: string;
  backHref?: string;
  backLabel?: string;
  /** "page" (default) or "drawer" (no back link — Drawer chrome already has close). */
  variant?: "page" | "drawer";
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
}: ChatThreadViewProps) {
  const isDrawer = variant === "drawer";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        /* Mark-read is best-effort — still show the thread if Supabase hiccups. */
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load conversation.");
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
    if (!quoteOpen || portal !== "vendor" || !conversationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const bookings = await fetchVendorBookings("active");
        if (cancelled) return;
        const match =
          bookings.find((b) => b.conversation_id === conversationId) ??
          bookings.find((b) => b.initiator === "client" && b.status === "pending");
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

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !uid) return;
    setSending(true);
    setError(null);
    try {
      const msg = await postMessage(conversationId, text);
      setDraft("");
      setMessages((prev) => [...prev, msg]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CLEARED_EVENT));
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white px-5 py-8 shadow-sm ring-1 ring-neutral-200/50">
        <LoadingState label="Loading conversation…" variant="centered" className="py-4" />
      </div>
    );
  }

  if (error && !conv) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">
          {error}
        </p>
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  const peerName = conv?.peer_display_name?.trim() || "Conversation";

  return (
    <div
      className={`flex max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50 ${
        isDrawer ? "min-h-[50dvh]" : "h-full min-h-0 flex-1"
      }`}
    >
      {/* Header — matches inbox card header */}
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        {backHref && !isDrawer ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-0.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{backLabel}</span>
          </Link>
        ) : null}

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          aria-hidden
        >
          {peerInitials(peerName)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-semibold text-neutral-900">
            {peerName}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {portal === "vendor"
              ? "Messages with this client — send a custom quote whenever you're ready."
              : "Messages with this vendor about your event."}
          </p>
        </div>

        {portal === "vendor" && conv ? (
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

      {portal === "vendor" && conv ? (
        <VendorQuoteFormModal
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          conversationId={conversationId}
          clientUserId={conv.client_user_id}
          quotePrefill={quotePrefill ?? undefined}
        />
      ) : null}

      {error ? (
        <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/50">
          {error}
        </p>
      ) : null}

      {/* Messages */}
      <div
        className={`scroll-pane flex min-h-0 flex-1 flex-col px-5 py-5 ${
          isDrawer ? "min-h-[36dvh]" : ""
        }`}
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-neutral-500">
            No messages yet. Send the first one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_user_id === uid;
              const quote = asQuoteMetadata(m);
              if (quote) {
                const href =
                  portal === "vendor"
                    ? `/vendor/bookings/${encodeURIComponent(quote.booking_request_id)}`
                    : `/client/bookings/${encodeURIComponent(quote.booking_request_id)}`;
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <Link
                      href={href}
                      className="group flex w-full max-w-[85%] items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 transition hover:border-primary/40 hover:bg-primary/[0.1] sm:max-w-[70%]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Receipt className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-primary/80">
                          Custom quote
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-neutral-900">
                          {quote.event_name}
                        </span>
                        <span className="mt-0.5 block text-sm text-neutral-600">
                          {quote.total_label} · tap to view details
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-primary/50 transition group-hover:text-primary"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
                      mine
                        ? "bg-primary text-white"
                        : "bg-primary/[0.07] text-neutral-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={`mt-1.5 text-[11px] tabular-nums ${
                        mine ? "text-white/65" : "text-neutral-500"
                      }`}
                    >
                      {formatBubbleTime(m.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer — same card language as rest of portal */}
      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            placeholder="Type a message…"
            rows={2}
            className="min-h-[72px] w-full min-w-0 flex-1 resize-none rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 ring-1 ring-neutral-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            variant="primary"
            size="md"
            loading={sending}
            disabled={!draft.trim()}
            icon={<Send className="h-4 w-4" aria-hidden />}
            onClick={() => void send()}
            className="shrink-0"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
