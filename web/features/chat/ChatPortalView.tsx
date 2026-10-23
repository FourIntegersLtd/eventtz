"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CARD_SURFACE } from "@/components/ui/tokens";
import {
  CHAT_CONVERSATIONS_PAGE_SIZE,
  type ChatConversation,
  fetchConversationsPage,
} from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LoadingState } from "@/components/ui/LoadingState";
import { TablePagination } from "@/components/ui/TablePagination";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import { ChatThreadView } from "@/features/chat/ChatThreadView";
import { helpHubTabHref, helpMessagesPath } from "@/lib/helpHub";
import Link from "next/link";
import { formatDate } from "@/lib/dateFormat";

type ChatPortalViewProps = {
  portal: "client" | "vendor";
  /** Present on `/{portal}/help/messages/[conversationId]` - absent on the index route. */
  selectedConversationId?: string;
  /** Link to the Contact tab when the inbox is empty. */
  contactTabHref?: string;
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
    return formatDate(d, "time");
  }
  return formatDate(d, "dayMonth");
}

/**
 * Master-detail messages view - conversation list on the left, active thread on
 * the right (desktop); mobile shows one pane at a time via `MasterDetailLayout`.
 */
export function ChatPortalView({
  portal,
  selectedConversationId,
  contactTabHref,
}: ChatPortalViewProps) {
  const router = useRouter();
  const [rows, setRows] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const base = helpMessagesPath(portal);
  const contactHref = contactTabHref ?? helpHubTabHref(portal, "contact");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchConversationsPage(offset, CHAT_CONVERSATIONS_PAGE_SIZE);
      setRows(page.conversations);
      setTotal(page.total);
    } catch {
      setError("Could not load messages.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("chat:data_refresh", () => void load(), [portal, load]);

  return (
    <MasterDetailLayout
      hasSelection={!!selectedConversationId}
      list={
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${CARD_SURFACE}`}>
            <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
              <p className="text-sm font-semibold text-neutral-900">
                {loading
                  ? "Messages"
                  : `${total} conversation${total === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="scroll-pane min-h-0 flex-1">
              {loading ? (
                <div className="p-5">
                  <LoadingState label="Loading conversations…" variant="centered" branded />
                </div>
              ) : error ? (
                <div className="m-5">
                  <LottieFailureInline message={error} />
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  className="border-0 py-16"
                  variant="messages"
                  title="No conversations yet"
                  action={
                    <Link
                      href={contactHref}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Contact the team
                    </Link>
                  }
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
              {!loading && !error && total > CHAT_CONVERSATIONS_PAGE_SIZE ? (
                <TablePagination
                  offset={offset}
                  limit={CHAT_CONVERSATIONS_PAGE_SIZE}
                  total={total}
                  pageRowCount={rows.length}
                  onPrevious={() => setOffset(Math.max(0, offset - CHAT_CONVERSATIONS_PAGE_SIZE))}
                  onNext={() => setOffset(offset + CHAT_CONVERSATIONS_PAGE_SIZE)}
                />
              ) : null}
            </div>
          </div>
        </div>
      }
      detail={
        selectedConversationId ? (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <ChatThreadView
              portal={portal}
              conversationId={selectedConversationId}
              backHref={base}
              backLabel="Messages"
            />
          </div>
        ) : loading ? (
          <div
            className={`flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden ${CARD_SURFACE}`}
          >
            <LoadingState label="Loading conversations…" variant="centered" branded />
          </div>
        ) : (
          <div
            className={`flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden ${CARD_SURFACE}`}
          >
            <EmptyState
              className="border-0"
              variant="messages"
              title={total === 0 ? "No conversations yet" : "Select a conversation"}
            />
          </div>
        )
      }
    />
  );
}
