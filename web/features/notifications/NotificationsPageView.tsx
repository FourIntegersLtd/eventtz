"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Calendar,
  CalendarClock,
  Check,
  MessageCircle,
  Shield,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchClientNotificationsFeedPage,
  fetchVendorNotificationsFeedPage,
  type NotificationFeedItem,
  type NotificationFeedReadState,
  type NotificationFeedTopic,
} from "@/lib/notificationsFeedApi";
import { markAllClientBookingNotificationsRead } from "@/lib/clientNotificationsApi";
import {
  fetchVendorBookingNotificationsUnreadCount,
  markAllVendorBookingNotificationsRead,
} from "@/lib/vendorNotificationsApi";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { useServerList } from "@/lib/useServerList";

type NotificationsPageViewProps = {
  portal: "client" | "vendor";
};

type NotificationTab = "all" | "unread" | "bookings" | "payments" | "messages";

const TAB_LABELS: { value: NotificationTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "bookings", label: "Bookings" },
  { value: "payments", label: "Payments" },
  { value: "messages", label: "Messages" },
];

/** Whether a notice is about money, judged from its words; only picks the icon and tint, never the filter. */
function isPaymentItem(item: NotificationFeedItem): boolean {
  const text = `${item.title} ${item.body ?? ""}`.toLowerCase();
  return text.includes("payout") || text.includes("payment") || text.includes("paid");
}

/** The feed's read state and topic that one tab asks the api for. */
function tabQuery(tab: NotificationTab): {
  readState: NotificationFeedReadState;
  topic: NotificationFeedTopic;
} {
  if (tab === "unread") return { readState: "unread", topic: "all" };
  if (tab === "all") return { readState: "all", topic: "all" };
  return { readState: "all", topic: tab };
}

/** Icon for one feed row. */
function RowIcon({ item }: { item: NotificationFeedItem }) {
  const iconProps = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
  if (item.kind === "chat_unread_summary") return <MessageCircle {...iconProps} />;
  if (item.kind === "dispute_update") return <Shield {...iconProps} />;
  if (isPaymentItem(item)) return <Wallet {...iconProps} />;
  if (item.kind === "booking_update") return <Calendar {...iconProps} />;
  return <Bell {...iconProps} />;
}

/** Tint class of the icon tile for one feed row. */
function tileClass(item: NotificationFeedItem): string {
  if (item.kind === "dispute_update") return "ez-icon-tile ez-icon-tile--danger";
  if (isPaymentItem(item)) return "ez-icon-tile ez-icon-tile--success";
  return "ez-icon-tile ez-icon-tile--gold";
}

/** "12 Mar, 14:30" for a stored timestamp, or nothing when it is missing or invalid. */
function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date, "dayMonthTime");
}

/** One notification row: a link when the notice has a destination. */
function NotificationRow({ item }: { item: NotificationFeedItem }) {
  const className = `ez-list-row${item.unread ? " ez-list-row--unread" : ""}`;
  const content = (
    <>
      <span className={tileClass(item)}>
        <RowIcon item={item} />
      </span>
      <div className="ez-list-row__main">
        <span className="ez-strong">{item.title}</span>
        {item.body ? <span className="ez-small">{item.body}</span> : null}
      </div>
      <span className="ez-caption">{whenLabel(item.created_at)}</span>
    </>
  );
  return item.href ? (
    <Link className={className} href={item.href}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

const CLIENT_KIND_ICON: Record<NotificationFeedItem["kind"], typeof Bell> = {
  booking_update: CalendarClock,
  dispute_update: ShieldAlert,
  chat_unread_summary: MessageCircle,
};

/** One row of the client feed, with the client page's original card-list look. */
function ClientNotificationRow({ item }: { item: NotificationFeedItem }) {
  const Icon = CLIENT_KIND_ICON[item.kind] ?? Bell;
  const content = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{item.title}</p>
        {item.body ? <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{item.body}</p> : null}
        <p className="mt-1 text-xs text-ink-3">{formatDateTime(item.created_at)}</p>
      </div>
      {item.unread ? (
        <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" aria-label="Unread" />
      ) : null}
    </div>
  );
  return (
    <li className="border-b border-line last:border-b-0">
      {item.href ? (
        <Link
          href={item.href}
          className="block min-h-11 px-4 py-3.5 transition duration-150 ease-out hover:bg-surface-3 active:bg-surface-3"
        >
          {content}
        </Link>
      ) : (
        <div className="px-4 py-3">{content}</div>
      )}
    </li>
  );
}

/**
 * Notification history for one portal, the destination behind the bell's "View all".
 * Client: opening the page marks booking notices read (the client page supplies its own header).
 * Vendor: topic tabs, and notices stay unread until "Mark all as read" (design V29).
 */
export function NotificationsPageView({ portal }: NotificationsPageViewProps) {
  const isVendor = portal === "vendor";
  const [tab, setTab] = useState<NotificationTab>("all");
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);

  const list = useServerList<NotificationFeedItem, { tab: NotificationTab }>({
    filters: { tab },
    errorMessage: "Could not load notifications.",
    fetchPage: async ({ offset, limit, filters }) => {
      const { readState, topic } = tabQuery(filters.tab);
      const fetchFeed = isVendor ? fetchVendorNotificationsFeedPage : fetchClientNotificationsFeedPage;
      const page = await fetchFeed(offset, limit, readState, topic);
      if (isVendor) {
        void fetchVendorBookingNotificationsUnreadCount()
          .then(setUnreadBadgeCount)
          .catch(() => setUnreadBadgeCount(0));
      }
      return { items: page.items, total: page.total };
    },
  });

  // Client: opening or paging the feed marks booking notices read, once per page and only after
  // that page rendered, so its unread dots show what was new on arrival. A realtime reload does
  // not mark again. Best effort: the feed renders either way.
  const markedOffsetRef = useRef<number | null>(null);
  useEffect(() => {
    if (isVendor || list.loading || markedOffsetRef.current === list.offset) return;
    markedOffsetRef.current = list.offset;
    void markAllClientBookingNotificationsRead().catch(() => undefined);
  }, [isVendor, list.loading, list.offset]);

  useRealtimeRefresh(
    ["booking_notifications:refresh", "chat:unread_refresh", "disputes:refresh"],
    list.reload,
    [portal],
  );

  const markAll = async () => {
    setMarking(true);
    setMarkError(null);
    try {
      await markAllVendorBookingNotificationsRead();
      list.reload();
    } catch {
      setMarkError("Could not mark notifications as read.");
    } finally {
      setMarking(false);
    }
  };

  const error = list.error ?? markError;

  if (!isVendor) {
    return (
      <div className="w-full min-w-0 max-w-3xl">
        {error ? <LottieFailureInline message={error} className="mb-3" /> : null}
        <div className="rounded-2xl border border-line bg-white">
          {list.loading && list.items.length === 0 ? (
            <div className="p-3">
              <SkeletonListRows rows={5} />
            </div>
          ) : list.items.length === 0 ? (
            <EmptyState className="border-0" lottie="allCaughtUp" title="You're all caught up" />
          ) : (
            <>
              <ul>
                {list.items.map((item, index) => (
                  <ClientNotificationRow
                    key={`${item.notification_id ?? item.booking_id ?? index}-${index}`}
                    item={item}
                  />
                ))}
              </ul>
              <TablePagination
                offset={list.offset}
                limit={list.limit}
                total={list.total}
                pageRowCount={list.items.length}
                loading={list.loading}
                onPrevious={list.goPrevious}
                onNext={list.goNext}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ez-stack ez-stack--lg">
      {isVendor ? (
        <>
          <PageHeader
            descriptionSize="body"
            eyebrow="Account"
            title="Notifications"
            description="Everything that needs your attention, newest first."
            actions={
              <Button
                variant="secondary"
                type="button"
                disabled={marking || unreadBadgeCount === 0}
                onClick={() => void markAll()}
                icon={<Check size={18} strokeWidth={1.75} aria-hidden />}
              >
                {marking ? "Marking…" : "Mark all as read"}
              </Button>
            }
          />
          <Tabs
            aria-label="Notification topics"
            value={tab}
            onChange={setTab}
            options={TAB_LABELS.map((option) => ({
              ...option,
              count: option.value === "unread" ? unreadBadgeCount : 0,
            }))}
          />
        </>
      ) : null}

      {error ? <LottieFailureInline message={error} /> : null}

      <Card variant="muted">
        <CardBody>
          {list.loading ? (
            <LoadingState label="Loading notifications…" variant="inline" />
          ) : list.items.length === 0 ? (
            <EmptyState className="border-0" lottie="allCaughtUp" title="You're all caught up" />
          ) : (
            list.items.map((item, index) => (
              <NotificationRow
                key={`${item.notification_id ?? item.booking_id ?? item.title}-${index}`}
                item={item}
              />
            ))
          )}
        </CardBody>
      </Card>

      <TablePagination
        offset={list.offset}
        limit={list.limit}
        total={list.total}
        pageRowCount={list.items.length}
        loading={list.loading}
        onPrevious={list.goPrevious}
        onNext={list.goNext}
      />
    </div>
  );
}
