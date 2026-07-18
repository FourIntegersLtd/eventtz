"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { StarRating } from "@/components/ui/StarRating";
import { formatEventDate } from "@/lib/dateFormat";
import { AttentionFeedCard } from "@/features/dashboard/AttentionFeedCard";
import { dashboardNotificationUpdates } from "@/features/dashboard/attentionFeedHelpers";
import type { AttentionItem } from "@/features/dashboard/attentionTypes";
import { eventDayOver } from "@/features/bookings/eventDay";
import { useClientDashboard } from "./useClientDashboard";
import { ClientBookingsCalendarCard } from "./ClientBookingsCalendarCard";

function daysUntil(iso: string): number {
  const start = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "In progress";
  return `${days} days to go`;
}

export function ClientDashboardView() {
  const router = useRouter();
  const { user } = useAuth();
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const {
    loadStatus,
    chatUnread,
    updates,
    bookingsByDate,
    upcomingAgenda,
    needsReview,
    activeBookings,
    errorMessage,
  } = useClientDashboard(Boolean(user?.id));

  const nextEvent = upcomingAgenda[0] ?? null;
  const nextEventDays = nextEvent ? daysUntil(nextEvent.event_date) : null;

  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (loadStatus !== "ready") return [];
    const items: AttentionItem[] = [];
    const pendingQuoteIds = new Set(
      activeBookings.filter((b) => b.initiator === "vendor" && b.status === "pending").map((b) => b.id),
    );

    for (const b of activeBookings) {
      if (b.initiator === "vendor" && b.status === "pending") {
        items.push({
          id: `quote-${b.id}`,
          priority: 0,
          tone: "urgent",
          title: `Quote from ${b.vendor_display_name}`,
          subtitle: `${b.event_name} · ${formatEventDate(b.event_date)}`,
          href: `/client/bookings/${b.id}`,
          ctaLabel: "Review",
        });
      }
    }

    for (const b of activeBookings) {
      if (b.status !== "accepted" || b.payment_status !== "paid") continue;
      if (!b.completion_waiting_on) continue;
      if (!eventDayOver(b.event_date, b.event_end_date)) continue;
      if (b.completion_waiting_on === "vendor") {
        items.push({
          id: `completion-wait-${b.id}`,
          priority: 2,
          tone: "info",
          title: `Waiting for ${b.vendor_display_name} to confirm`,
          subtitle: `${b.event_name} · you've confirmed — the vendor is paid once they confirm too`,
          href: `/client/bookings/${b.id}`,
          ctaLabel: "View",
        });
      } else {
        items.push({
          id: `completion-confirm-${b.id}`,
          priority: 0,
          tone: "urgent",
          title: "How did your event go?",
          subtitle: `${b.event_name} · confirm it's complete, or report a problem`,
          href: `/client/bookings/${b.id}`,
          ctaLabel: "Confirm",
        });
      }
    }

    if (chatUnread > 0) {
      items.push({
        id: "chat-unread",
        priority: 1,
        tone: "urgent",
        title: `${chatUnread} unread message${chatUnread === 1 ? "" : "s"}`,
        subtitle: "Open Messages to reply",
        href: "/client/messages",
        ctaLabel: "Reply",
      });
    }

    for (const it of dashboardNotificationUpdates(updates, pendingQuoteIds)) {
      items.push({
        id: `update-${it.notification_id ?? it.booking_id ?? it.title}`,
        priority: 2,
        tone: "info",
        title: it.title,
        subtitle: it.body ?? undefined,
        href: it.href ?? "/client/bookings",
        ctaLabel: "Open",
      });
    }

    for (const b of needsReview.slice(0, 3)) {
      items.push({
        id: `review-${b.id}`,
        priority: 3,
        tone: "positive",
        title: `Rate ${b.vendor_display_name}`,
        subtitle: b.event_name,
        href: `/client/bookings/${b.id}`,
        trailing: (
          <StarRating
            rating={0}
            size="sm"
            onRate={(value) => router.push(`/client/bookings/${b.id}?rate=${value}`)}
          />
        ),
      });
    }

    return items;
  }, [loadStatus, activeBookings, chatUnread, updates, needsReview, router]);

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6 pt-2">
      {loadStatus === "error" && errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {loadStatus === "ready" ? (
        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          {nextEvent ? (
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="text-[13px] text-neutral-500">Your next event</p>
                <p className="mt-1 truncate font-heading text-xl font-semibold text-neutral-900 sm:text-2xl">
                  {nextEvent.event_name}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  with {nextEvent.vendor_display_name} · {formatEventDate(nextEvent.event_date)}
                  {nextEventDays !== null ? (
                    <span className="text-neutral-400"> · {countdownLabel(nextEventDays)}</span>
                  ) : null}
                </p>
              </div>
              <ButtonLink
                href={`/client/bookings/${nextEvent.id}`}
                variant="secondary"
                size="sm"
                className="shrink-0"
              >
                View booking
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-4 bg-primary/[0.04] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="font-heading text-lg font-semibold text-neutral-900">
                  No upcoming events yet
                </p>
                <p className="mt-1 text-sm text-neutral-600">Browse vendors to get started.</p>
              </div>
              <ButtonLink href="/client/browse" variant="secondary" size="sm" className="shrink-0 gap-2">
                <Compass className="h-4 w-4" aria-hidden />
                Browse vendors
              </ButtonLink>
            </div>
          )}
        </section>
      ) : null}

      <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <AttentionFeedCard items={attentionItems} loading={loadStatus === "loading"} />
        </div>

        <div className="min-w-0 lg:col-span-1">
          {loadStatus === "ready" ? (
            <ClientBookingsCalendarCard
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
          <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-700">
            No bookings on this day.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {(bookingsByDate[selectedDayKey] ?? []).map((b) => (
              <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{b.event_name}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">{b.vendor_display_name}</p>
                    {b.event_end_date ? (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Runs to {formatEventDate(b.event_end_date)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/client/bookings/${encodeURIComponent(b.id)}`}
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
