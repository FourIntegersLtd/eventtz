"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Compass, Heart, MessageSquare, PartyPopper } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { formatEventDate } from "@/lib/dateFormat";
import { AttentionFeedCard } from "@/features/dashboard/AttentionFeedCard";
import { dashboardNotificationUpdates } from "@/features/dashboard/attentionFeedHelpers";
import type { AttentionItem } from "@/features/dashboard/attentionTypes";
import { useMarketplaceBookmarks } from "@/features/marketplace/useMarketplaceBookmarks";
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
  return `${days} days`;
}

export function ClientDashboardView() {
  const router = useRouter();
  const { user } = useAuth();
  const { savedCount } = useMarketplaceBookmarks();
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const {
    loadStatus,
    awaitingVendorCount,
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
    <div className="w-full min-w-0 max-w-full space-y-6 pt-2">
      {loadStatus === "error" && errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {loadStatus === "ready" ? (
        nextEvent ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#5a2a8a] p-6 text-white shadow-sm sm:p-8">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/70">Your next event</p>
                <p className="mt-1 truncate font-heading text-2xl font-semibold sm:text-3xl">
                  {nextEvent.event_name}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  with {nextEvent.vendor_display_name} · {formatEventDate(nextEvent.event_date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
                    {countdownLabel(nextEventDays ?? 0)}
                  </p>
                  {nextEventDays !== null && nextEventDays > 1 ? (
                    <p className="text-xs text-white/70">to go</p>
                  ) : null}
                </div>
                <Link
                  href={`/client/bookings/${nextEvent.id}`}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:opacity-90"
                >
                  View booking
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#5a2a8a] p-6 text-white shadow-sm sm:p-8">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <PartyPopper className="h-9 w-9 shrink-0 text-white/80" aria-hidden />
                <div>
                  <p className="font-heading text-xl font-semibold sm:text-2xl">
                    No upcoming events yet
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Browse vendors and send a request to get your next event planned.
                  </p>
                </div>
              </div>
              <Link
                href="/client/browse"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:opacity-90"
              >
                <Compass className="h-4 w-4" aria-hidden />
                Browse vendors
              </Link>
            </div>
          </div>
        )
      ) : null}

      {loadStatus === "ready" ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-5">
          <Link
            href="/client/bookings?tab=active&status=pending"
            className="flex min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 transition hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Calendar className="h-4 w-4" aria-hidden />
            </span>
            <span className="mt-3 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
              {awaitingVendorCount}
            </span>
            <span className="text-sm font-medium text-neutral-500">Awaiting vendor response</span>
          </Link>

          <Link
            href="/client/messages"
            className="flex min-w-0 w-full flex-col justify-between overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 transition hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" aria-hidden />
            </span>
            <span className="mt-3 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
              {chatUnread}
            </span>
            <span className="text-sm font-medium text-neutral-500">Unread messages</span>
          </Link>

          <Link
            href="/client/favorites"
            className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 transition hover:shadow-md hover:-translate-y-0.5 sm:col-span-1"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Heart className="h-4 w-4" aria-hidden />
            </span>
            <span className="mt-3 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
              {savedCount}
            </span>
            <span className="text-sm font-medium text-neutral-500">Saved vendors</span>
          </Link>
        </div>
      ) : null}

      <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AttentionFeedCard
            items={attentionItems}
            loading={loadStatus === "loading"}
          />
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-1">
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

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50">
            <p className="font-heading text-sm font-semibold text-neutral-900">
              Planning something new?
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Search vendors by category, location, and date to send a booking request.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              onClick={() => router.push("/client/browse")}
            >
              Browse vendors
            </Button>
          </div>
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
                    <p className="mt-0.5 text-sm text-neutral-600">{b.vendor_display_name}</p>
                    {/* The modal title already states the selected date — only show
                        an end date here, for events that span more than one day. */}
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
