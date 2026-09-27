"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addMonths, labelMonth, labelShortDate, localDateKey, monthGridCells } from "@/domains/client-dashboard/dashboardStats";
import type { ClientBookingListItem } from "@/domains/client-dashboard/api";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A left/right chevron as an inline SVG — `web/` has no icon library (AGENTS.md). */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

type Props = {
  bookingsByDate: Record<string, ClientBookingListItem[]>;
  agendaRows: readonly ClientBookingListItem[];
  onSelectDate: (dateKey: string) => void;
};

/**
 * The client's booking calendar: a month grid with a dot (and count) on days
 * that hold an accepted upcoming booking, plus the next five in a short
 * agenda. Clicking an active day raises the day-detail modal via
 * `onSelectDate`.
 */
export function BookingsCalendarCard({ bookingsByDate, agendaRows, onSelectDate }: Props) {
  const todayKey = localDateKey(new Date());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const grid = useMemo(() => monthGridCells(monthCursor), [monthCursor]);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Calendar</p>
          <p className="mt-1 font-heading text-lg font-semibold text-neutral-900">{labelMonth(monthCursor)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthCursor((date) => addMonths(date, -1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            aria-label="Previous month"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor((date) => addMonths(date, 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            aria-label="Next month"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <div className="hidden sm:mt-4 sm:grid sm:grid-cols-7 sm:gap-1.5">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {weekday}
          </div>
        ))}
        {grid.map((cell, index) => {
          if (!cell) return <div key={`blank-${index}`} className="h-10 rounded-xl" />;
          const count = bookingsByDate[cell.key]?.length ?? 0;
          const isToday = cell.key === todayKey;
          const isActive = count > 0;
          return (
            <button
              key={cell.key}
              type="button"
              disabled={!isActive}
              onClick={() => onSelectDate(cell.key)}
              className={`relative flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                isToday
                  ? "border-primary-border bg-primary-soft text-primary"
                  : "border-neutral-200 bg-white text-neutral-800"
              } ${isActive ? "hover:bg-neutral-50" : "opacity-50"} disabled:cursor-default`}
              aria-label={isActive ? `${cell.key} (${count} bookings)` : cell.key}
            >
              {cell.day}
              {isActive ? (
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {count > 1 ? <span className="text-[10px] font-semibold text-neutral-500">{count}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Upcoming</p>
          <Link href="/client/bookings" className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
            View all
          </Link>
        </div>

        {agendaRows.length === 0 ? (
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">No upcoming bookings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl bg-neutral-50">
            {agendaRows.map((booking) => (
              <li key={booking.booking_request_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{booking.event_name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {labelShortDate(booking.event_date.slice(0, 10))}
                    {booking.vendor_display_name ? ` · ${booking.vendor_display_name}` : ""}
                  </p>
                </div>
                <Link
                  href={`/client/bookings/${encodeURIComponent(booking.booking_request_id)}`}
                  className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Details
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
