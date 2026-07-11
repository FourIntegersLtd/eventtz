"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Store, User } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchAdminChatMessages, type AdminChatMessageItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";

const VENDOR_BUBBLE = "border border-primary/35 bg-primary/[0.15] text-neutral-900";
const CLIENT_BUBBLE = "border border-neutral-200 bg-white text-neutral-900";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

function ParticipantAvatar({
  role,
  label,
  align,
}: {
  role: "client" | "vendor";
  label: string;
  align: "left" | "right";
}) {
  const Icon = role === "client" ? User : Store;
  const ring =
    role === "client"
      ? "border-primary/30 bg-primary/[0.1] text-primary"
      : "border-primary/35 bg-primary/[0.08] text-primary";

  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-0.5 ${align === "right" ? "items-end" : "items-start"}`}
      title={label}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${ring}`} aria-hidden>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <span className="max-w-[4.5rem] truncate text-center text-[9px] font-medium text-neutral-500">
        {label}
      </span>
    </div>
  );
}

type AdminChatThreadProps = {
  conversationId: string;
  className?: string;
  /** Hide participant header when parties are already shown above (e.g. dispute drawer). */
  compact?: boolean;
};

export function AdminChatThread({ conversationId, className = "", compact = false }: AdminChatThreadProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminChatMessageItem[]>([]);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [vendorUserId, setVendorUserId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastLoadedId = useRef<string | null>(null);

  const loadThread = useCallback(async (id: string) => {
    setError(null);
    setLoading(true);
    setMessages([]);
    setClientUserId(null);
    setVendorUserId(null);
    setClientEmail(null);
    setVendorName(null);
    setHasLoaded(false);
    try {
      const res = await fetchAdminChatMessages(id);
      setMessages(res.messages);
      setClientUserId(res.client_user_id);
      setVendorUserId(res.vendor_user_id);
      setClientEmail(res.client_email);
      setVendorName(res.vendor_display_name);
      setHasLoaded(true);
    } catch {
      setError("Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = conversationId.trim();
    if (!id || lastLoadedId.current === id) return;
    lastLoadedId.current = id;
    void loadThread(id);
  }, [conversationId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return <AdminLoadingState label="Loading messages…" rows={3} />;
  }

  if (error) {
    return <AdminErrorBanner message={error} />;
  }

  if (!hasLoaded) {
    return null;
  }

  return (
    <div className={`flex w-full flex-col gap-3 ${compact ? "" : "min-h-[280px]"} ${className}`.trim()}>
      {!compact ? (
        clientUserId && vendorUserId ? (
          <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${adminCard} px-4 py-3`}>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/[0.08] text-primary">
                <User className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Client</p>
                <p className="truncate font-medium text-neutral-900">
                  {clientEmail ?? `${clientUserId.slice(0, 8)}…`}
                </p>
              </div>
            </div>
            <div className="hidden h-8 w-px shrink-0 bg-neutral-200 sm:block" aria-hidden />
            <div className="flex min-w-0 items-center gap-2 text-sm sm:justify-end">
              <div className="min-w-0 text-right sm:text-left">
                <p className="text-xs text-neutral-500">Vendor</p>
                <p className="truncate font-medium text-neutral-900">
                  {vendorName ?? "Vendor"} · {vendorUserId.slice(0, 8)}…
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/[0.06] text-primary">
                <Store className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
            </div>
          </div>
        ) : (
          <EmptyState title="Conversation not found" />
        )
      ) : null}

      <div
        className={`flex w-full flex-1 flex-col overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 ${
          compact ? "max-h-[min(45vh,360px)] min-h-[160px]" : "max-h-[min(60vh,520px)] min-h-[200px]"
        }`}
        aria-label="Conversation messages"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">No messages in this thread.</p>
        ) : !clientUserId || !vendorUserId ? (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={`${adminCard} px-3 py-2 text-sm`}>
                <p className="font-mono text-[10px] text-neutral-500">{m.sender_user_id}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-neutral-900">{m.body}</p>
                <p className="mt-1.5 text-[10px] text-neutral-400">{formatTime(m.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-7">
            {messages.map((m) => {
              const fromClient = m.sender_user_id === clientUserId;
              const clientLabel = clientEmail?.trim()
                ? clientEmail.length > 28
                  ? `${clientEmail.slice(0, 26)}…`
                  : clientEmail
                : "Client";
              const vendorLabel = vendorName?.trim() ? vendorName : "Vendor";
              const bubbleSurface = fromClient ? CLIENT_BUBBLE : VENDOR_BUBBLE;
              const headerClass = fromClient ? "text-neutral-600" : "text-primary";

              return (
                <li
                  key={m.id}
                  className={`flex w-full items-end ${fromClient ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`flex min-w-0 max-w-full items-end gap-2 ${
                      fromClient ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <ParticipantAvatar
                      role={fromClient ? "client" : "vendor"}
                      label={fromClient ? clientLabel : vendorLabel}
                      align={fromClient ? "left" : "right"}
                    />
                    <div
                      className={`min-w-0 max-w-[calc(100%-3rem)] rounded-2xl px-3 py-2 text-sm sm:max-w-[min(85%,24rem)] ${bubbleSurface}`}
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${headerClass}`}>
                        {fromClient ? `${clientLabel} · Client` : `${vendorLabel} · Vendor`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-neutral-900">{m.body}</p>
                      <p className="mt-1.5 font-mono text-[10px] text-neutral-400">
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
