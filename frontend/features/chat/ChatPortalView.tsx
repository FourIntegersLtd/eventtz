"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { type ChatConversation, fetchConversations } from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import { ChatThreadView } from "@/features/chat/ChatThreadView";

type ChatPortalViewProps = {
  portal: "client" | "vendor";
  /** Present on `/{portal}/messages/[conversationId]` — absent on the index route. */
  selectedConversationId?: string;
};

function peerInitials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Compact activity label: time today, else short date. */
function formatActivity(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Master-detail messages view — conversation list on the left, active thread on
 * the right (desktop); mobile shows one pane at a time via `MasterDetailLayout`.
 */
export function ChatPortalView({ portal, selectedConversationId }: ChatPortalViewProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = portal === "client" ? "/client/messages" : "/vendor/messages";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchConversations();
      setRows(list);
    } catch {
      setError("Could not load messages.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("chat:data_refresh", () => void load(), [portal, load]);

  return (
    <MasterDetailLayout
      hasSelection={!!selectedConversationId}
      list={
        <div className="flex h-full min-h-0 flex-col">
          <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${portalCard}`}>
            <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
              <p className="text-sm font-semibold text-neutral-900">
                {loading
                  ? "Messages"
                  : `${rows.length} conversation${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="scroll-pane min-h-0 flex-1">
              {loading ? (
                <div className="p-5">
                  <SkeletonListRows rows={5} />
                </div>
              ) : error ? (
                <p className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : rows.length === 0 ? (
                <EmptyState
                  className="border-0 py-16"
                  icon={<MessageSquare className="h-8 w-8" strokeWidth={1.5} />}
                  title="No conversations yet"
                />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {rows.map((c) => {
                    const unread = c.unread_count > 0;
                    const sel = selectedConversationId === c.id;
                    const when = formatActivity(c.last_message_at ?? c.created_at);
                    const isSupport = c.kind === "support";

                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`${base}/${c.id}`)}
                          aria-current={sel}
                          className={`relative flex w-full items-start gap-3.5 px-5 py-5 text-left transition duration-150 ease-out sm:px-6 ${
                            sel
                              ? "bg-primary/[0.05]"
                              : unread
                                ? "bg-primary/[0.03] hover:bg-primary/[0.05]"
                                : "hover:bg-neutral-50/90"
                          }`}
                        >
                          {sel ? (
                            <span
                              className="absolute inset-y-3.5 left-0 w-[3px] rounded-full bg-primary"
                              aria-hidden
                            />
                          ) : null}

                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                              unread || isSupport
                                ? "bg-primary/15 text-primary"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                            aria-hidden
                          >
                            {peerInitials(c.peer_display_name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p
                                className={`min-w-0 truncate text-[15px] tracking-tight text-neutral-900 ${
                                  unread ? "font-semibold" : "font-medium"
                                }`}
                              >
                                {c.peer_display_name}
                              </p>
                              {when ? (
                                <p
                                  className={`shrink-0 text-[12px] tabular-nums ${
                                    unread ? "font-medium text-primary" : "text-neutral-400"
                                  }`}
                                >
                                  {when}
                                </p>
                              ) : null}
                            </div>
                            <p
                              className={`mt-1.5 truncate text-sm ${
                                unread ? "font-medium text-neutral-700" : "text-neutral-500"
                              }`}
                            >
                              {unread
                                ? `${c.unread_count} unread message${c.unread_count === 1 ? "" : "s"}`
                                : isSupport
                                  ? "Eventtz Support"
                                  : portal === "vendor"
                                    ? "Client conversation"
                                    : "Vendor conversation"}
                            </p>
                          </div>

                          {unread ? (
                            <span className="mt-1 min-w-[1.25rem] shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-white">
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      }
      detail={
        selectedConversationId ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ChatThreadView
              portal={portal}
              conversationId={selectedConversationId}
              backHref={base}
              backLabel="Messages"
            />
          </div>
        ) : (
          <div
            className={`flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden ${portalCard}`}
          >
            <EmptyState
              className="border-0"
              icon={<MessageSquare className="h-8 w-8" strokeWidth={1.5} />}
              title={rows.length === 0 ? "No conversations yet" : "Select a conversation"}
            />
          </div>
        )
      }
    />
  );
}
