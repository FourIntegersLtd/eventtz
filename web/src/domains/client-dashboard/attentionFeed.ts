/**
 * The client dashboard "To do" attention feed: pure classification of the
 * data the dashboard already fetched into a priority-ordered list of rows.
 *
 * Ported from the baseline's `ClientDashboardView` attention `useMemo`, plus
 * `attentionFeedHelpers`. The rating nudge is represented as a plain string
 * (`rateBookingId`) rather than a React node so this module stays importable
 * by `node --test` — the view maps it to the one-tap star rating.
 */
import { eventDayOver, formatEventDate } from "@/domains/client-dashboard/dashboardStats";
import type { ClientBookingListItem, NotificationFeedItem } from "@/domains/client-dashboard/api";

/** The row's urgency colour band. */
export type AttentionTone = "urgent" | "info" | "positive";

/** One row in the feed. Lower `priority` sorts first. */
export type AttentionFeedEntry = {
  id: string;
  priority: number;
  tone: AttentionTone;
  title: string;
  subtitle?: string;
  href: string;
  /** When set, the row renders a one-tap star rating linking to `/client/bookings/:id?rate=N`. */
  rateBookingId?: string;
};

/** Plain-language copy for the dashboard's quote and completion nudges. */
const CLIENT_DASHBOARD_COPY = {
  quoteTitle: (vendorName: string) => `Quote from ${vendorName}`,
  completionWaitTitle: (vendorName: string) => `Waiting for ${vendorName} to confirm`,
  completionWaitSubtitle: (eventName: string) =>
    `${eventName} · you've confirmed - the vendor is paid once they confirm too`,
  completionConfirmTitle: "How did your event go?",
  completionConfirmSubtitle: (eventName: string) =>
    `${eventName} · confirm it's complete, or report a problem`,
} as const;

/** Sorts feed rows by priority, ties keeping their insertion order. */
export function sortAttentionItems(items: readonly AttentionFeedEntry[]): AttentionFeedEntry[] {
  return [...items].sort((first, second) => first.priority - second.priority);
}

/** Drop feed rows that duplicate live booking rows already shown above in the feed. */
export function dashboardNotificationUpdates(
  updates: readonly NotificationFeedItem[],
  coveredBookingIds: ReadonlySet<string>,
): NotificationFeedItem[] {
  return updates.filter((item) => {
    if (!item.unread || item.kind === "chat_unread_summary") return false;
    if (item.booking_id && coveredBookingIds.has(item.booking_id)) return false;
    return true;
  });
}

/** The dashboard data the attention classifier reads. */
export type ClientAttentionInput = {
  activeBookings: readonly ClientBookingListItem[];
  needsReview: readonly ClientBookingListItem[];
  chatUnread: number;
  updates: readonly NotificationFeedItem[];
  /** Injected so completion nudges can be tested against a pinned "now". */
  now: Date;
};

/**
 * Builds the dashboard's attention feed: vendor quotes awaiting the client,
 * completion confirmations, the unread-chat summary, notification updates and
 * up to three review nudges.
 */
export function buildClientAttentionItems(input: ClientAttentionInput): AttentionFeedEntry[] {
  const items: AttentionFeedEntry[] = [];
  const pendingQuoteIds = new Set(
    input.activeBookings
      .filter((booking) => booking.initiator === "vendor" && booking.booking_status === "pending")
      .map((booking) => booking.booking_request_id),
  );

  for (const booking of input.activeBookings) {
    if (booking.initiator === "vendor" && booking.booking_status === "pending") {
      items.push({
        id: `quote-${booking.booking_request_id}`,
        priority: 0,
        tone: "urgent",
        title: CLIENT_DASHBOARD_COPY.quoteTitle(booking.vendor_display_name),
        subtitle: `${booking.event_name} · ${formatEventDate(booking.event_date)}`,
        href: `/client/bookings/${booking.booking_request_id}`,
      });
    }
  }

  for (const booking of input.activeBookings) {
    if (booking.booking_status !== "accepted" || booking.payment_status !== "paid") continue;
    if (!booking.completion_waiting_on) continue;
    if (!eventDayOver(booking.event_date, booking.event_end_date, input.now)) continue;
    if (booking.completion_waiting_on === "vendor") {
      items.push({
        id: `completion-wait-${booking.booking_request_id}`,
        priority: 2,
        tone: "info",
        title: CLIENT_DASHBOARD_COPY.completionWaitTitle(booking.vendor_display_name),
        subtitle: CLIENT_DASHBOARD_COPY.completionWaitSubtitle(booking.event_name),
        href: `/client/bookings/${booking.booking_request_id}`,
      });
    } else {
      items.push({
        id: `completion-confirm-${booking.booking_request_id}`,
        priority: 0,
        tone: "urgent",
        title: CLIENT_DASHBOARD_COPY.completionConfirmTitle,
        subtitle: CLIENT_DASHBOARD_COPY.completionConfirmSubtitle(booking.event_name),
        href: `/client/bookings/${booking.booking_request_id}`,
      });
    }
  }

  if (input.chatUnread > 0) {
    items.push({
      id: "chat-unread",
      priority: 1,
      tone: "urgent",
      title: `${input.chatUnread} unread message${input.chatUnread === 1 ? "" : "s"}`,
      subtitle: "Open Messages to reply",
      href: "/client/help",
    });
  }

  for (const update of dashboardNotificationUpdates(input.updates, pendingQuoteIds)) {
    items.push({
      id: `update-${update.notification_id ?? update.booking_id ?? update.title}`,
      priority: 2,
      tone: "info",
      title: update.title,
      subtitle: update.body ?? undefined,
      href: update.href ?? "/client/bookings",
    });
  }

  for (const booking of input.needsReview.slice(0, 3)) {
    items.push({
      id: `review-${booking.booking_request_id}`,
      priority: 3,
      tone: "positive",
      title: `Rate ${booking.vendor_display_name}`,
      subtitle: booking.event_name,
      href: `/client/bookings/${booking.booking_request_id}`,
      rateBookingId: booking.booking_request_id,
    });
  }

  return items;
}
