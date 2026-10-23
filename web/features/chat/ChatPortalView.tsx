"use client";

import { useRouter } from "next/navigation";
import { CARD_SURFACE } from "@/components/ui/tokens";
import { useServerList } from "@/lib/useServerList";
import {
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
  const list = useServerList<ChatConversation>({
    filters: {},
    errorMessage: "Could not load messages.",
    fetchPage: async ({ offset, limit }) => {
      const page = await fetchConversationsPage(offset, limit);
      return { items: page.conversations, total: page.total };
    },
  });
  const rows = list.items;
  const { total, error, reload } = list;
  // Rows stay on screen while a refresh or the next page loads; only the first load shows the spinner.
  const loading = list.loading && rows.length === 0;

  const base = helpMessagesPath(portal);
  const contactHref = contactTabHref ?? helpHubTabHref(portal, "contact");

  useRealtimeRefresh("chat:data_refresh", reload, [portal, reload]);

  return (
    <MasterDetailLayout
      hasSelection={!!selectedConversationId}
      list={
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${CARD_SURFACE}`}>
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <p className="text-sm font-semibold text-ink">
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
                <ul className="divide-y divide-line">
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
                                : "hover:bg-surface-3"
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
                                : "bg-surface-3 text-ink-2"
                            }`}
                            aria-hidden
                          >
                            {peerInitials(c.peer_display_name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p
                                className={`min-w-0 truncate text-[15px] tracking-tight text-ink ${
                                  unread ? "font-semibold" : "font-medium"
                                }`}
                              >
                                {c.peer_display_name}
                              </p>
                              {when ? (
                                <p
                                  className={`shrink-0 text-[12px] tabular-nums ${
                                    unread ? "font-medium text-primary" : "text-ink-3"
                                  }`}
                                >
                                  {when}
                                </p>
                              ) : null}
                            </div>
                            <p
                              className={`mt-1.5 truncate text-sm ${
                                unread ? "font-medium text-ink-2" : "text-ink-3"
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
              {!loading && !error && total > list.limit ? (
                <TablePagination
                  offset={list.offset}
                  limit={list.limit}
                  total={total}
                  pageRowCount={rows.length}
                  loading={list.loading}
                  onPrevious={list.goPrevious}
                  onNext={list.goNext}
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
