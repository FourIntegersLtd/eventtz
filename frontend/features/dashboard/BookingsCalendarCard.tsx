"use client";

import { portalCard } from "@/components/portal-shell/portalTheme";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarAgendaItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  date_key: string; // YYYY-MM-DD
  href: string;
};

export type CalendarBookingsByDate<TItem extends { id: string }> = Record<string, TItem[]>;

function labelMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function labelShortDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function weekdayIndexMonFirst(d: Date): number {
  // JS getDay: Sun=0..Sat=6 -> convert to Mon=0..Sun=6
  return (d.getDay() + 6) % 7;
}

type Props<TItem extends { id: string }> = {
  title?: string;
  subtitle?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  bookingsByDate: CalendarBookingsByDate<TItem>;
  agendaRows: CalendarAgendaItem[];
  onSelectDate: (dateKey: string) => void;
};

export function BookingsCalendarCard<TItem extends { id: string }>({
  title = "Calendar",
  subtitle,
  viewAllHref,
  viewAllLabel = "View all",
  bookingsByDate,
  agendaRows,
  onSelectDate,
}: Props<TItem>) {
  const todayKey = localDateKey(new Date());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const grid = useMemo(() => {
    const first = startOfMonth(monthCursor);
    const leadingBlanks = weekdayIndexMonFirst(first);
    const dim = daysInMonth(first);
    const cells: Array<{ key: string; day: number } | null> = [];
    for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
    for (let day = 1; day <= dim; day += 1) {
      const key = localDateKey(new Date(first.getFullYear(), first.getMonth(), day));
      cells.push({ key, day });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);

  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className={`w-full min-w-0 overflow-hidden ${portalCard} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
          <p className="mt-1 font-heading text-lg font-semibold text-neutral-900">
            {labelMonth(monthCursor)}
          </p>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthCursor((d) => addMonths(d, -1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor((d) => addMonths(d, 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="hidden sm:mt-4 sm:grid sm:grid-cols-7 sm:gap-1.5">
        {weekday.map((w) => (
          <div
            key={w}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400"
          >
            {w}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell) return <div key={`blank-${idx}`} className="h-10 rounded-xl" />;
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
                  ? "border-primary/40 bg-primary/[0.06] text-primary"
                  : "border-neutral-200 bg-white text-neutral-800"
              } ${isActive ? "hover:bg-neutral-50" : "opacity-50"} disabled:cursor-default`}
              aria-label={isActive ? `${cell.key} (${count} bookings)` : cell.key}
            >
              {cell.day}
              {isActive ? (
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {count > 1 ? (
                    <span className="text-[10px] font-semibold text-neutral-500">{count}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Upcoming</p>
          <Link
            href={viewAllHref}
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            {viewAllLabel}
          </Link>
        </div>

        {agendaRows.length === 0 ? (
          <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            No upcoming bookings yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl bg-neutral-50">
            {agendaRows.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{it.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {labelShortDate(it.date_key)}
                    {it.subtitle ? ` · ${it.subtitle}` : ""}
                  </p>
                </div>
                <Link
                  href={it.href}
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

