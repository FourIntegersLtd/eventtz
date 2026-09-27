"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { useRealtimeStream } from "@/capabilities/realtime-stream/useRealtimeStream";
import { fetchChatUnreadCount, fetchClientBookings, fetchClientNotificationFeed, type ClientBookingListItem, type NotificationFeedItem } from "@/domains/client-dashboard/api";
import { countdownLabel, daysUntil, deriveClientDashboardModel, formatEventDate } from "@/domains/client-dashboard/dashboardStats";
import { buildClientAttentionItems, type AttentionFeedEntry } from "@/domains/client-dashboard/attentionFeed";
import { AttentionFeedCard } from "@/domains/client-dashboard/AttentionFeedCard";
import { BookingsCalendarCard } from "@/domains/client-dashboard/BookingsCalendarCard";
import { DayDetailModal } from "@/domains/client-dashboard/DayDetailModal";

/** The dashboard's load state: still fetching, failed, or ready with all four data sets. */
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; active: ClientBookingListItem[]; completed: ClientBookingListItem[]; chatUnread: number; updates: NotificationFeedItem[] };

/** The next-event hero: the soonest upcoming booking, or an empty state that nudges toward browsing. */
function NextEventHero({ nextEvent, today }: { nextEvent: ClientBookingListItem | null; today: Date }) {
  const nextEventDays = nextEvent ? daysUntil(nextEvent.event_date, today) : null;

  return (
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
              {nextEventDays !== null ? <span className="text-neutral-400"> · {countdownLabel(nextEventDays)}</span> : null}
            </p>
          </div>
          <Link
            href={`/client/bookings/${nextEvent.booking_request_id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-muted"
          >
            View booking
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 bg-primary-soft px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold text-neutral-900">No upcoming events yet</p>
            <p className="mt-1 text-sm text-neutral-600">Browse vendors to get started.</p>
          </div>
          <Link
            href="/client/browse"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-muted"
          >
            Browse vendors
          </Link>
        </div>
      )}
    </section>
  );
}

/**
 * `/client/dashboard` — the client's home screen. Loads bookings, chat unread
 * count and the notification feed, then shows the next event, the "To do" feed
 * and the booking calendar (with a day-detail dialog). Auth/shell wiring is in
 * the portal layout, so this view assumes a signed-in client.
 */
export function ClientDashboardView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [active, completed, chatUnread, updates] = await Promise.all([
        fetchClientBookings("active"),
        fetchClientBookings("completed"),
        fetchChatUnreadCount(),
        fetchClientNotificationFeed(),
      ]);
      setState({ status: "ready", active, completed, chatUnread, updates });
    } catch (cause: unknown) {
      // Keep showing previously-loaded data on a background refresh failure.
      setState((current) =>
        current.status === "ready"
          ? current
          : { status: "error", message: platformErrorDetail(cause) ?? "We couldn't load your dashboard. Try refreshing the page." },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the tab becomes visible again, so a returning client sees fresh
  // data even while the realtime stream is down (the api does not publish
  // events yet).
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [load]);

  useRealtimeStream(
    ["booking_changed", "chat_unread_changed", "booking_notifications_changed", "dispute_changed"],
    () => void load(),
  );

  const { model, attentionItems } = useMemo(() => {
    if (state.status !== "ready") {
      return { model: null, attentionItems: [] as AttentionFeedEntry[] };
    }
    const now = new Date();
    const derivedModel = deriveClientDashboardModel(state.active, state.completed, now);
    const items = buildClientAttentionItems({
      activeBookings: state.active,
      needsReview: derivedModel.needsReview,
      chatUnread: state.chatUnread,
      updates: state.updates,
      now,
    });
    return { model: derivedModel, attentionItems: items };
  }, [state]);

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      {state.status === "error" ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{state.message}</p>
      ) : null}

      {state.status === "ready" && model ? <NextEventHero nextEvent={model.upcomingAgenda[0] ?? null} today={new Date()} /> : null}

      <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          <AttentionFeedCard items={attentionItems} loading={state.status === "loading"} />
        </div>

        <div className="min-w-0 lg:col-span-1">
          {state.status === "ready" && model ? (
            <BookingsCalendarCard
              bookingsByDate={model.bookingsByDate}
              agendaRows={model.upcomingAgenda}
              onSelectDate={setSelectedDayKey}
            />
          ) : null}
        </div>
      </div>

      {state.status === "ready" && model && selectedDayKey ? (
        <DayDetailModal
          dateKey={selectedDayKey}
          bookings={model.bookingsByDate[selectedDayKey] ?? []}
          onClose={() => setSelectedDayKey(null)}
        />
      ) : null}
    </div>
  );
}
