"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Calendar, Check, MessageCircle, Shield, Wallet } from "lucide-react";
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
import { formatDate } from "@/lib/dateFormat";
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
