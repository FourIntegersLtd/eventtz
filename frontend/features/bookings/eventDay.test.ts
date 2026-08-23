import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventDayOver } from "@/features/bookings/eventDay";

/** Mirrors backend completion_rules.event_day_over for the same UTC calendar inputs. */
function backendStyleEventDayOver(eventDate: string, eventEndDate?: string | null): boolean {
  const dayStr = (eventEndDate || eventDate || "").slice(0, 10);
  if (!dayStr) return false;
  const day = new Date(`${dayStr}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return false;
  const end = day.getTime() + 24 * 60 * 60 * 1000;
  return Date.now() >= end;
}

describe("eventDayOver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false on the event day and true the day after", () => {
    expect(eventDayOver("2026-08-23")).toBe(false);
    expect(backendStyleEventDayOver("2026-08-23")).toBe(false);
    vi.setSystemTime(new Date("2026-08-24T00:00:01Z"));
    expect(eventDayOver("2026-08-23")).toBe(true);
    expect(backendStyleEventDayOver("2026-08-23")).toBe(true);
  });

  it("uses event_end_date for multi-day events", () => {
    vi.setSystemTime(new Date("2026-08-24T23:00:00Z"));
    expect(eventDayOver("2026-08-20", "2026-08-24")).toBe(false);
    expect(backendStyleEventDayOver("2026-08-20", "2026-08-24")).toBe(false);
    vi.setSystemTime(new Date("2026-08-26T00:00:01Z"));
    expect(eventDayOver("2026-08-20", "2026-08-24")).toBe(true);
    expect(backendStyleEventDayOver("2026-08-20", "2026-08-24")).toBe(true);
  });

  it("returns false for invalid dates", () => {
    expect(eventDayOver("")).toBe(false);
    expect(eventDayOver("not-a-date")).toBe(false);
  });
});
