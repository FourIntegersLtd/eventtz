import Link from "next/link";
import { Spinner } from "@/foundation/ui";
import type { ConversationRow } from "@/domains/messages/api";
import { formatConversationActivity, formatUnreadBadge, peerInitials } from "@/domains/messages/messageFormatting";
import {
  CONTACT_TEAM_LABEL,
  conversationPath,
  conversationPreview,
  contactTeamPath,
  EMPTY_INBOX_TITLE,
  INBOX_HEADING,
  inboxCountLabel,
  LOADING_CONVERSATIONS,
  type MessagePortal,
} from "@/domains/messages/messageRoutes";

interface ConversationListViewProps {
  portal: MessagePortal;
  selectedConversationId?: string;
  conversations: readonly ConversationRow[];
  loading: boolean;
  error: string | null;
}

/**
 * The inbox pane: header, then loading, the error, an empty state, or the
 * threads in the order the API returned (newest activity first).
 */
export function ConversationListView({
  portal,
  selectedConversationId,
  conversations,
  loading,
  error,
}: ConversationListViewProps) {
  const viewerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-neutral-900">{loading ? INBOX_HEADING : inboxCountLabel(conversations.length)}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-5">
            <Spinner label={LOADING_CONVERSATIONS} />
          </div>
        ) : error ? (
          <p className="m-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-sm font-medium text-neutral-900">{EMPTY_INBOX_TITLE}</p>
            <Link href={contactTeamPath(portal)} className="text-sm font-medium text-primary hover:underline">
              {CONTACT_TEAM_LABEL}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {conversations.map((conversation) => {
              const unread = conversation.unread_count > 0;
              const selected = selectedConversationId === conversation.id;
              const support = conversation.kind === "support";
              const when = formatConversationActivity(
                conversation.last_message_at ?? conversation.created_at,
                new Date(),
                viewerTimeZone,
              );
              return (
                <li key={conversation.id}>
                  <Link
                    href={conversationPath(portal, conversation.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`relative flex w-full items-start gap-3.5 px-5 py-5 text-left transition duration-150 ease-out sm:px-6 ${
                      selected
                        ? "bg-primary/[0.05]"
                        : unread
                          ? "bg-primary/[0.03] hover:bg-primary/[0.05]"
                          : "hover:bg-neutral-50/90"
                    }`}
                  >
                    {selected ? <span className="absolute inset-y-3.5 left-0 w-[3px] rounded-full bg-primary" aria-hidden /> : null}
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        unread || support ? "bg-primary/15 text-primary" : "bg-neutral-100 text-neutral-600"
                      }`}
                      aria-hidden
                    >
                      {peerInitials(conversation.peer_display_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={`min-w-0 truncate text-[15px] tracking-tight text-neutral-900 ${
                            unread ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {conversation.peer_display_name}
                        </span>
                        {when ? (
                          <span
                            className={`shrink-0 text-[12px] tabular-nums ${unread ? "font-medium text-primary" : "text-neutral-400"}`}
                          >
                            {when}
                          </span>
                        ) : null}
                      </span>
                      <span className={`mt-1.5 block truncate text-sm ${unread ? "font-medium text-neutral-700" : "text-neutral-500"}`}>
                        {conversationPreview(portal, conversation.kind, conversation.unread_count)}
                      </span>
                    </span>
                    {unread ? (
                      <span className="mt-1 min-w-[1.25rem] shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-white">
                        {formatUnreadBadge(conversation.unread_count)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
