"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { MessageComposer } from "@/features/chat/MessageComposer";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  sendAdminMessages,
  type AdminMessageAudience,
} from "@/lib/adminMessagesApi";
import { searchAdminDirectoryUsers, type AdminDirectoryUser } from "@/lib/adminPlatformApi";
import { adminComposeMessageSchema, parseForm } from "@/lib/validation";

type RecipientMode = "selected" | AdminMessageAudience;

export function AdminMessagesComposeView() {
  const [mode, setMode] = useState<RecipientMode>("selected");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminDirectoryUser[]>([]);
  const [hits, setHits] = useState<AdminDirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setResultsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.user_id)), [selected]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchAdminDirectoryUsers(q, { limit: 8 })
        .then((users) => {
          if (seq !== searchSeq.current) return;
          setHits(users.filter((u) => !selectedIds.has(u.user_id)));
        })
        .catch((e: unknown) => {
          if (seq !== searchSeq.current) return;
          setHits([]);
          setError(getApiErrorDetail(e) ?? "Could not search users.");
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, selectedIds]);

  const addUser = (user: AdminDirectoryUser) => {
    setSelected((prev) =>
      prev.some((p) => p.user_id === user.user_id) ? prev : [...prev, user],
    );
    setQuery("");
    setHits([]);
    setResultsOpen(false);
  };

  const removeUser = (userId: string) => {
    setSelected((prev) => prev.filter((u) => u.user_id !== userId));
  };

  const sendCompose = async () => {
    if (sending) return;
    const parsed = parseForm(adminComposeMessageSchema, {
      body: draft,
      audience: mode,
      recipientCount: selected.length,
    });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendAdminMessages({
        body: parsed.data.body,
        ...(mode === "selected"
          ? { recipient_user_ids: selected.map((u) => u.user_id) }
          : { audience: mode }),
      });
      const failN = result.failures?.length ?? 0;
      setSuccess(
        failN
          ? `Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"} (${failN} failed).`
          : `Sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}.`,
      );
      setDraft("");
      if (mode === "selected") {
        setSelected([]);
        setQuery("");
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not send messages.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <AdminErrorBanner message={error} /> : null}
      {success ? (
        <p className="text-sm font-medium text-primary">{success}</p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Recipients</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            Choose specific users or broadcast to a whole audience.
          </p>
        </div>

        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          <fieldset className="px-5 py-4 sm:px-6">
            <legend className="sr-only">Recipient mode</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ["selected", "Selected users"],
                  ["clients", "All clients"],
                  ["vendors", "All vendors"],
                  ["users", "All users"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2 text-neutral-700">
                  <input
                    type="radio"
                    name="recipient-mode"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "selected" ? (
            <div className="space-y-3 px-5 py-4 sm:px-6">
              {selected.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {selected.map((u) => (
                    <li key={u.user_id}>
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 py-1 pl-2.5 pr-1 text-sm text-neutral-900">
                        <span className="min-w-0 truncate">{u.label}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-primary/70">
                          {u.kind}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUser(u.user_id)}
                          className="rounded-md p-1 text-primary/70 hover:bg-primary/15 hover:text-primary"
                          aria-label={`Remove ${u.label}`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div ref={searchWrapRef} className="relative max-w-lg">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
                  <Search className="h-4 w-4" aria-hidden />
                </div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResultsOpen(true);
                  }}
                  onFocus={() => setResultsOpen(true)}
                  placeholder="Search by email or name…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Search recipients"
                  aria-expanded={resultsOpen && query.trim().length > 0}
                  aria-controls="admin-message-recipient-results"
                />
                {resultsOpen && query.trim().length > 0 ? (
                  <ul
                    id="admin-message-recipient-results"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-md"
                  >
                    {searching ? (
                      <li className="px-3 py-2.5 text-sm text-neutral-500">Searching…</li>
                    ) : hits.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-neutral-500">No matching users.</li>
                    ) : (
                      hits.map((u) => (
                        <li key={`${u.kind}-${u.user_id}`} role="option">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                            onClick={() => addUser(u)}
                          >
                            <span className="min-w-0 flex-1 truncate text-neutral-900">{u.label}</span>
                            <span className="shrink-0 text-xs uppercase tracking-wide text-neutral-400">
                              {u.kind}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Message</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">Sent as Eventtz support.</p>
        </div>
        <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
          <MessageComposer
            variant="compose"
            value={draft}
            onChange={setDraft}
            onSend={() => void sendCompose()}
            loading={sending}
            rows={6}
            placeholder="Write a support message…"
            sendLabel="Send"
            enterToSend={false}
          />
        </div>
      </section>
    </div>
  );
}
