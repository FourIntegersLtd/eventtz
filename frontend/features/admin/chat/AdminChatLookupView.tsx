"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Store, User, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextField } from "@/components/ui/TextField";
import { fetchAdminChatMessages, type AdminChatMessageItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { adminCard } from "@/features/admin/adminTheme";

const VENDOR_BUBBLE = "border border-primary/35 bg-primary/[0.15] text-neutral-900";
const CLIENT_BUBBLE = "border border-neutral-200 bg-white text-neutral-900";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function AdminChatLookupView() {
  const searchParams = useSearchParams();
  const [cid, setCid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminChatMessageItem[]>([]);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [vendorUserId, setVendorUserId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAutoLoadedConversation = useRef<string | undefined>(undefined);

  const loadThread = useCallback(async (rawId: string) => {
    const id = rawId.trim();
    if (!id) return;
    if (!UUID_RE.test(id)) {
      setError("Enter a valid conversation UUID.");
      setHasLoaded(false);
      return;
    }
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
    const c = searchParams.get("conversation")?.trim();
    if (!c || lastAutoLoadedConversation.current === c) return;
    lastAutoLoadedConversation.current = c;
    setCid(c);
    void loadThread(c);
  }, [searchParams, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="space-y-4">
      <AdminPageHeader />

      <form
        className={`flex flex-col gap-3 sm:flex-row sm:items-end ${adminCard} p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void loadThread(cid);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <TextField
            label="Conversation UUID"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="font-mono"
          />
          {cid ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setCid("");
                setHasLoaded(false);
                setMessages([]);
                setError(null);
              }}
              className="absolute right-2 top-[2.125rem] inline-flex min-h-11 min-w-11 items-center justify-center rounded text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Button type="submit" disabled={loading || !cid.trim()}>
          {loading ? "Loading…" : "Load thread"}
        </Button>
      </form>

      {error ? <AdminErrorBanner message={error} /> : null}
      {loading ? <AdminLoadingState label="Loading messages…" rows={3} /> : null}

      {hasLoaded ? (
        <div className="flex min-h-[280px] w-full max-w-3xl flex-col gap-3">
          {clientUserId && vendorUserId ? (
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
            <EmptyState
              title="Conversation not found"
            />
          )}

          <div
            className="flex max-h-[min(60vh,520px)] min-h-[200px] w-full flex-1 flex-col overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/80 p-3"
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
      ) : null}
    </div>
  );
}
