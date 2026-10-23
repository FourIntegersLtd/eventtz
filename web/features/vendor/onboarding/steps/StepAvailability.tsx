"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { isPastIsoDate } from "@/lib/eventDateValidation";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { Chip } from "../../../../components/ui/Chip";
import { formatDate } from "@/lib/dateFormat";

export type StepAvailabilityProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

/** Weekday chips, Monday first; the index is what `availableWeekdays` stores. */
const WEEKDAY_SHORT_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
const MIN_BOOKINGS_PER_DAY = 1;
const MAX_BOOKINGS_PER_DAY = 20;

/** One cell of the month grid: an ISO date, its day number, and whether it is outside the month. */
type CalendarCell = { iso: string; day: number; outsideMonth: boolean };

/** Formats a local date as `YYYY-MM-DD`. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The weeks of a month as full Monday-first rows, padded with days from the neighbouring months. */
export function monthCells(year: number, monthIndex: number): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, offset) => {
    const date = new Date(year, monthIndex, 1 - leadingDays + offset);
    return {
      iso: toIsoDate(date),
      day: date.getDate(),
      outsideMonth: date.getMonth() !== monthIndex,
    };
  });
}

/** Availability step (design V05): working days, bookings per day, and a calendar of blocked dates. */
export function StepAvailability({ data, update }: StepAvailabilityProps) {
  // Open on the month of the first blocked date, so saved dates are visible straight away.
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [firstBlockedDate] = [...data.blockedDates].sort();
    const anchor = firstBlockedDate
      ? new Date(`${firstBlockedDate}T00:00:00`)
      : new Date();
    return { year: anchor.getFullYear(), monthIndex: anchor.getMonth() };
  });
  const monthLabel = formatDate(new Date(visibleMonth.year, visibleMonth.monthIndex, 1), "longMonthYear");

  const toggleDay = (weekday: number) => {
    const selected = new Set(data.availableWeekdays);
    if (selected.has(weekday)) selected.delete(weekday);
    else selected.add(weekday);
    update({ availableWeekdays: [...selected].sort() });
  };

  const toggleBlockedDate = (iso: string) => {
    if (isPastIsoDate(iso)) return;
    update({
      blockedDates: data.blockedDates.includes(iso)
        ? data.blockedDates.filter((blocked) => blocked !== iso)
        : [...data.blockedDates, iso],
    });
  };

  const shiftMonth = (months: number) => {
    const next = new Date(
      visibleMonth.year,
      visibleMonth.monthIndex + months,
      1,
    );
    setVisibleMonth({ year: next.getFullYear(), monthIndex: next.getMonth() });
  };

  const bookingsPerDay = Number.parseInt(data.maxBookingsPerDay, 10);
  const stepBookingsPerDay = (change: number) => {
    const base = Number.isNaN(bookingsPerDay)
      ? MIN_BOOKINGS_PER_DAY
      : bookingsPerDay;
    const next = Math.min(
      MAX_BOOKINGS_PER_DAY,
      Math.max(MIN_BOOKINGS_PER_DAY, base + change),
    );
    update({ maxBookingsPerDay: String(next) });
  };

  return (
    <div className="ez-availability">
      <div className="ez-availability__days">
        <span className="ez-label">Which days do you take bookings?</span>
        {WEEKDAY_SHORT_LABELS.map((label, weekday) => (
          <Chip
            key={label}
            active={data.availableWeekdays.includes(weekday)}
            onClick={() => toggleDay(weekday)}
          >
            {label}
          </Chip>
        ))}
      </div>
      <div className="ez-availability__limit">
        <div className="ez-stack ez-stack--sm">
          <span className="ez-label">Bookings per day</span>
          <span className="ez-help">
            How many events you can do on the same day ({MIN_BOOKINGS_PER_DAY} to{" "}
            {MAX_BOOKINGS_PER_DAY}).
          </span>
        </div>
        <div className="ez-hrow">
          <button
            className="ez-icon-btn ez-icon-btn--outline"
            type="button"
            aria-label="Fewer"
            onClick={() => stepBookingsPerDay(-1)}
          >
            <Minus size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <input
            className="ez-input w-[84px] text-center"
            type="number"
            min={MIN_BOOKINGS_PER_DAY}
            max={MAX_BOOKINGS_PER_DAY}
            value={data.maxBookingsPerDay}
            aria-label="Bookings per day"
            onChange={(event) =>
              update({ maxBookingsPerDay: event.target.value })
            }
          />
          <button
            className="ez-icon-btn ez-icon-btn--outline"
            type="button"
            aria-label="More"
            onClick={() => stepBookingsPerDay(1)}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
      <div className="ez-stack ez-stack--sm ez-cal-block">
        <span className="ez-label">
          Dates you are not available{" "}
          <span className="ez-label__opt">(optional)</span>
        </span>
        <div className="ez-cal-block__month">
          <button
            className="ez-icon-btn"
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft strokeWidth={1.75} aria-hidden />
          </button>
          <span className="ez-strong">{monthLabel}</span>
          <button
            className="ez-icon-btn"
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="ez-cal">
          {WEEKDAY_SHORT_LABELS.map((label) => (
            <div key={label} className="ez-cal__dow">
              {label}
            </div>
          ))}
          {monthCells(visibleMonth.year, visibleMonth.monthIndex).map(
            (cell) => {
              const blocked = data.blockedDates.includes(cell.iso);
              const classes = ["ez-cal__day"];
              if (cell.outsideMonth) classes.push("ez-cal__day--muted");
              if (blocked) classes.push("ez-cal__day--blocked");
              classes.push("border-0 cursor-pointer");
              if (!blocked) classes.push("bg-transparent");
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={classes.join(" ")}
                  aria-pressed={blocked}
                  aria-label={cell.iso}
                  disabled={isPastIsoDate(cell.iso)}
                  onClick={() => toggleBlockedDate(cell.iso)}
                >
                  {cell.day}
                </button>
              );
            },
          )}
        </div>
        <div className="ez-legend">
          <span>
            <i className="bg-[var(--ez-surface-3)]" />
            Blocked
          </span>
          <span>
            <i className="bg-primary-soft" />
            Booked
          </span>
        </div>
      </div>
    </div>
  );
}
