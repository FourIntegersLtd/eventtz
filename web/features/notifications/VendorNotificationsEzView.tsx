"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Calendar, Check, MessageCircle, Shield, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LoadingState } from "@/components/ui/LoadingState";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchVendorNotificationsFeedPage,
  NOTIFICATIONS_FEED_PAGE_SIZE,
  type NotificationFeedItem,
  type NotificationFeedReadState,
  type NotificationFeedTopic,
} from "@/lib/notificationsFeedApi";
import { fetchVendorBookingNotificationsUnreadCount, markAllVendorBookingNotificationsRead } from "@/lib/vendorNotificationsApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { formatDate } from "@/lib/dateFormat";

type NotificationTab = "all" | "unread" | "bookings" | "payments" | "messages";

const TABS: { id: NotificationTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "bookings", label: "Bookings" },
  { id: "payments", label: "Payments" },
  { id: "messages", label: "Messages" },
];

function isPaymentItem(item: NotificationFeedItem): boolean {
  const text = `${item.title} ${item.body ?? ""}`.toLowerCase();
  return text.includes("payout") || text.includes("payment") || text.includes("paid");
}

function tabQuery(tab: NotificationTab): {
  readState: NotificationFeedReadState;
  topic: NotificationFeedTopic;
} {
  if (tab === "unread") return { readState: "unread", topic: "all" };
  if (tab === "bookings") return { readState: "all", topic: "bookings" };
  if (tab === "payments") return { readState: "all", topic: "payments" };
  if (tab === "messages") return { readState: "all", topic: "messages" };
  return { readState: "all", topic: "all" };
}

function iconFor(item: NotificationFeedItem) {
  if (item.kind === "chat_unread_summary") return MessageCircle;
  if (item.kind === "dispute_update") return Shield;
  if (isPaymentItem(item)) return Wallet;
  if (item.kind === "booking_update") return Calendar;
  return Bell;
}

function tileClass(item: NotificationFeedItem): string {
  if (item.kind === "dispute_update") return "ez-icon-tile ez-icon-tile--danger";
  if (isPaymentItem(item)) return "ez-icon-tile ez-icon-tile--success";
  return "ez-icon-tile ez-icon-tile--gold";
}

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(date, "dayMonthTime");
}

/** Vendor notification history (design V29). Unread stays unread until Mark all as read. */
export function VendorNotificationsEzView() {
  const [items, setItems] = useState<NotificationFeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [marking, setMarking] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);

  const load = () => {
    setLoading(true);
    setError(null);
    const { readState, topic } = tabQuery(tab);
    void fetchVendorNotificationsFeedPage(offset, NOTIFICATIONS_FEED_PAGE_SIZE, readState, topic)
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
      })
      .catch(() => setError("Could not load notifications."))
      .finally(() => setLoading(false));
    void fetchVendorBookingNotificationsUnreadCount()
      .then(setUnreadBadgeCount)
      .catch(() => setUnreadBadgeCount(0));
  };

  useEffect(() => {
    load();
  }, [offset, tab]);

  useRealtimeRefresh(
    ["booking_notifications:refresh", "chat:unread_refresh", "disputes:refresh"],
    load,
    [],
  );

  const rows = items ?? [];

  const markAll = async () => {
    setMarking(true);
    try {
      await markAllVendorBookingNotificationsRead();
      setItems((current) => (current ?? []).map((item) => ({ ...item, unread: false })));
    } catch {
      setError("Could not mark notifications as read.");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Account"
        title="Notifications"
        description="Everything that needs your attention, newest first."
        actions={
          <button className="ez-btn ez-btn--secondary" type="button" disabled={marking || unreadBadgeCount === 0} onClick={() => void markAll()}>
            <Check size={18} strokeWidth={1.75} aria-hidden />
            {marking ? "Marking…" : "Mark all as read"}
          </button>
        }
      />

      <div className="ez-tabs" role="tablist">
        {TABS.map((item) => {
          const count = item.id === "unread" ? unreadBadgeCount : 0;
          return (
            <button
              key={item.id}
              type="button"
              className={`ez-tab${tab === item.id ? " ez-tab--active" : ""}`}
              aria-selected={tab === item.id}
              onClick={() => {
                setTab(item.id);
                setOffset(0);
              }}
            >
              {item.label}
              {count > 0 ? <span className="ez-tab__count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {error ? <LottieFailureInline message={error} /> : null}

      <div className="ez-card ez-card--flat">
        <div className="ez-card__body">
          {loading ? (
            <LoadingState label="Loading notifications…" variant="inline" />
          ) : rows.length === 0 ? (
            <EmptyState className="border-0" lottie="allCaughtUp" title="You're all caught up" />
          ) : (
            rows.map((item) => {
              const Icon = iconFor(item);
              const row = (
                <>
                  <span className={tileClass(item)}>
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="ez-list-row__main">
                    <span className="ez-strong">{item.title}</span>
                    {item.body ? <span className="ez-small">{item.body}</span> : null}
                  </div>
                  <span className="ez-caption">{whenLabel(item.created_at)}</span>
                </>
              );
              const className = `ez-list-row${item.unread ? " ez-list-row--unread" : ""}`;
              return item.href ? (
                <Link key={item.notification_id ?? item.title} className={className} href={item.href}>
                  {row}
                </Link>
              ) : (
                <div key={item.notification_id ?? item.title} className={className}>
                  {row}
                </div>
              );
            })
          )}
        </div>
      </div>

      <TablePagination
        offset={offset}
        limit={NOTIFICATIONS_FEED_PAGE_SIZE}
        total={total}
        pageRowCount={rows.length}
        loading={loading}
        onPrevious={() =>
          setOffset((current) => Math.max(0, current - NOTIFICATIONS_FEED_PAGE_SIZE))
        }
        onNext={() => setOffset((current) => current + NOTIFICATIONS_FEED_PAGE_SIZE)}
      />
    </div>
  );
}
