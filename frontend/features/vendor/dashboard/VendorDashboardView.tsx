"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { formatEventDate, shortDateLabel } from "@/lib/dateFormat";
import { AttentionFeedCard } from "@/features/dashboard/AttentionFeedCard";
import { dashboardNotificationUpdates } from "@/features/dashboard/attentionFeedHelpers";
import type { AttentionItem } from "@/features/dashboard/attentionTypes";
import { useVendorDashboard } from "./useVendorDashboard";
import { VendorBookingsCalendarCard } from "./VendorBookingsCalendarCard";

function daysUntil(iso: string): number {
  const start = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

export function VendorDashboardView() {
  const { user } = useAuth();
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const {
    loadStatus,
    activeBookingsCount,
    pendingBookingsCount,
    chatUnread,
    updates,
    needsResponse,
    bookingsByDate,
    upcomingAgenda,
    errorMessage,
  } = useVendorDashboard(Boolean(user?.id));

  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (loadStatus !== "ready") return [];
    const items: AttentionItem[] = [];
    const pendingBookingIds = new Set(needsResponse.map((b) => b.id));

    for (const b of needsResponse) {
      items.push({
        id: `pending-${b.id}`,
        priority: 0,
        tone: "urgent",
        title: b.event_name,
        subtitle: b.client_email ? `Waiting for your reply · ${b.client_email}` : "Waiting for your reply",
        timestamp: shortDateLabel(b.event_date),
        href: `/vendor/bookings/${b.id}`,
      });
    }

    if (chatUnread > 0) {
      items.push({
        id: "chat-unread",
        priority: 1,
        tone: "urgent",
        title: `${chatUnread} unread message${chatUnread === 1 ? "" : "s"}`,
        subtitle: "Open Messages to reply",
        href: "/vendor/messages",
      });
    }

    for (const it of dashboardNotificationUpdates(updates, pendingBookingIds)) {
      items.push({
        id: `update-${it.notification_id ?? it.booking_id ?? it.title}`,
        priority: 2,
        tone: "info",
        title: it.title,
        subtitle: it.body ?? undefined,
        href: it.href ?? "/vendor/bookings",
      });
    }

    const next = upcomingAgenda[0];
    if (next) {
      const d = daysUntil(next.event_date);
      if (d >= 0 && d <= 3) {
        items.push({
          id: `upcoming-${next.id}`,
          priority: 3,
          tone: "info",
          title: next.event_name,
          subtitle: d === 0 ? "Happening today" : d === 1 ? "Happening tomorrow" : `In ${d} days`,
          timestamp: shortDateLabel(next.event_date),
          href: `/vendor/bookings/${next.id}`,
        });
      }
    }

    return items;
  }, [loadStatus, needsResponse, chatUnread, updates, upcomingAgenda]);

  return (
    <div className="space-y-6 pt-2">
      {loadStatus === "error" && errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          {loadStatus === "ready" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Link
                href="/vendor/bookings?tab=active"
                className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 transition hover:shadow-md hover:-translate-y-0.5 sm:p-6"
              >
                <p className="text-base font-medium text-neutral-500">Active bookings</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  {activeBookingsCount}
                </p>
              </Link>
              <Link
                href="/vendor/bookings?tab=active&status=pending"
                className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 transition hover:shadow-md hover:-translate-y-0.5 sm:p-6"
              >
                <p className="text-base font-medium text-neutral-500">Pending response</p>
                <p
                  className={`mt-4 text-4xl font-semibold tracking-tight sm:text-5xl ${
                    pendingBookingsCount > 0 ? "text-amber-600" : "text-neutral-900"
                  }`}
                >
                  {pendingBookingsCount}
                </p>
              </Link>
            </div>
          ) : null}

          <AttentionFeedCard
            items={attentionItems}
            loading={loadStatus === "loading"}
          />
        </div>

        <div className="lg:col-span-1">
          {loadStatus === "ready" ? (
            <VendorBookingsCalendarCard
              bookingsByDate={bookingsByDate}
              agendaRows={upcomingAgenda}
              onSelectDate={(key) => {
                setSelectedDayKey(key);
                setDayOpen(true);
              }}
            />
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={dayOpen}
        onClose={() => setDayOpen(false)}
        title={selectedDayKey ? `Bookings on ${formatEventDate(selectedDayKey)}` : "Bookings"}
        maxWidthClassName="max-w-xl"
        zIndexClassName="z-[75]"
      >
        {!selectedDayKey ? (
          <p className="text-sm text-neutral-600">Select a day to see bookings.</p>
        ) : (bookingsByDate[selectedDayKey] ?? []).length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-700">
            No bookings on this day.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {(bookingsByDate[selectedDayKey] ?? []).map((b) => (
              <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{b.event_name}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {b.client_email ? b.client_email : "Client"}
                    </p>
                    {/* The modal title already states the selected date — only show
                        an end date here, for events that span more than one day. */}
                    {b.event_end_date ? (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Runs to {formatEventDate(b.event_end_date)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/vendor/bookings/${encodeURIComponent(b.id)}`}
                    onClick={() => setDayOpen(false)}
                    className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Open details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
