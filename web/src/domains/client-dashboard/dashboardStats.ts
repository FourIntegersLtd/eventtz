/**
 * Pure grouping, counting, label and calendar logic for the client dashboard,
 * ported from the baseline's `useClientDashboard` and `ClientDashboardView`.
 * Kept separate from the view so it is testable with `node --test` without
 * mounting a component or mocking `fetch`.
 *
 * All dates that matter are `YYYY-MM-DD` strings or noon-UTC `Date`s; noon is
 * used so a day does not drift across a DST boundary in the UK timezone.
 */
import type { ClientBookingListItem } from "@/domains/client-dashboard/api";

/** A local `YYYY-MM-DD` key for a date, e.g. "2026-07-12". */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A noon-UTC `Date` for a `YYYY-MM-DD` key — noon avoids off-by-one-day DST issues. */
function noonUtcSafeDateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

/** Adds a whole number of days without crossing a DST boundary off-by-one. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** The `YYYY-MM-DD` prefix of an ISO timestamp, or null when it has no date part. */
function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 10) return null;
  return iso.slice(0, 10);
}

/** Whole days from today (local midnight) to an event's `YYYY-MM-DD`; negative once it started. */
export function daysUntil(eventDate: string, today: Date): number {
  const start = new Date(`${eventDate.slice(0, 10)}T00:00:00`);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** The next-event countdown label: "Today", "Tomorrow", "In progress" or "N days to go". */
export function countdownLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "In progress";
  return `${days} days to go`;
}

/** True once the event's last day (UTC) has fully passed — post-event nudges start then. */
export function eventDayOver(eventDate: string, eventEndDate?: string | null, now: Date = new Date()): boolean {
  const dayString = (eventEndDate || eventDate || "").slice(0, 10);
  const day = new Date(`${dayString}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return false;
  return now.getTime() >= day.getTime() + 24 * 60 * 60 * 1000;
}

/** Formats a `YYYY-MM-DD` event date as e.g. "Sun, 12 Jul 2026". */
export function formatEventDate(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Everything the dashboard view needs, derived from its two booking lists. */
export type ClientDashboardModel = {
  /** Client-initiated requests still waiting on the vendor to accept/decline/quote. */
  awaitingVendorCount: number;
  /** Vendor-sent quotes waiting on the client to accept — a distinct, more urgent bucket. */
  awaitingClientCount: number;
  /** Accepted bookings that start today or later, soonest first, capped at five. */
  upcomingAgenda: ClientBookingListItem[];
  /** Accepted upcoming bookings spread across every day they run, keyed by `YYYY-MM-DD`. */
  bookingsByDate: Record<string, ClientBookingListItem[]>;
  /** Completed bookings with no review yet — powers the one-tap review nudge. */
  needsReview: ClientBookingListItem[];
};

/**
 * Groups and counts the client's bookings for the dashboard.
 *
 * `today` is injected so tests pin the "now" the grouping is computed around.
 */
export function deriveClientDashboardModel(
  active: readonly ClientBookingListItem[],
  completed: readonly ClientBookingListItem[],
  today: Date,
): ClientDashboardModel {
  const todayKey = localDateKey(today);
  const todayAtNoon = noonUtcSafeDateFromKey(todayKey);

  const accepted = active.filter((booking) => booking.booking_status === "accepted");
  const acceptedUpcoming = accepted.filter((booking) => {
    const startKey = dateKeyFromIso(booking.event_date);
    if (!startKey) return false;
    const start = noonUtcSafeDateFromKey(startKey);
    const endKey = dateKeyFromIso(booking.event_end_date);
    const end = endKey ? noonUtcSafeDateFromKey(endKey) : start;
    return end.getTime() >= todayAtNoon.getTime();
  });

  const bookingsByDate: Record<string, ClientBookingListItem[]> = {};
  for (const booking of acceptedUpcoming) {
    const startKey = dateKeyFromIso(booking.event_date);
    if (!startKey) continue;
    const start = noonUtcSafeDateFromKey(startKey);
    const endKey = dateKeyFromIso(booking.event_end_date);
    const end = endKey ? noonUtcSafeDateFromKey(endKey) : start;

    for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
      const key = localDateKey(day);
      if (noonUtcSafeDateFromKey(key).getTime() < todayAtNoon.getTime()) continue;
      (bookingsByDate[key] ??= []).push(booking);
    }
  }

  const upcomingAgenda = [...acceptedUpcoming]
    .sort((first, second) => {
      const firstKey = dateKeyFromIso(first.event_date) ?? "9999-12-31";
      const secondKey = dateKeyFromIso(second.event_date) ?? "9999-12-31";
      return firstKey.localeCompare(secondKey);
    })
    .slice(0, 5);

  return {
    awaitingVendorCount: active.filter(
      (booking) => booking.booking_status === "pending" && booking.initiator !== "vendor",
    ).length,
    awaitingClientCount: active.filter(
      (booking) => booking.booking_status === "pending" && booking.initiator === "vendor",
    ).length,
    upcomingAgenda,
    bookingsByDate,
    needsReview: completed.filter((booking) => !booking.has_review),
  };
}

/** One cell of the calendar grid: a day with its `YYYY-MM-DD` key, or null for a blank. */
export type CalendarGridCell = { key: string; day: number } | null;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Shifts a month cursor by a whole number of months. */
export function addMonths(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** JS `getDay()` numbers Sunday first; this converts to Monday-first (Mon=0..Sun=6). */
function weekdayIndexMonFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The calendar's month grid: leading blanks to line the first day up on a
 * weekday, then one cell per day, padded with trailing blanks to a full week.
 */
export function monthGridCells(monthCursor: Date): CalendarGridCell[] {
  const first = startOfMonth(monthCursor);
  const leadingBlanks = weekdayIndexMonFirst(first);
  const dayCount = daysInMonth(first);
  const cells: CalendarGridCell[] = [];
  for (let index = 0; index < leadingBlanks; index += 1) cells.push(null);
  for (let day = 1; day <= dayCount; day += 1) {
    const key = localDateKey(new Date(first.getFullYear(), first.getMonth(), day));
    cells.push({ key, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** The calendar's header month label, e.g. "February 2026". */
export function labelMonth(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** A compact agenda-row date, e.g. "Wed, 15 Feb". */
export function labelShortDate(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
