/** True once the event day (UTC) has fully passed — post-event nudges start then.
 *  Mirrors backend `event_day_over` in completion_rules.py for banner gating. */
export function eventDayOver(eventDate: string, eventEndDate?: string | null): boolean {
  const dayStr = (eventEndDate || eventDate || "").slice(0, 10);
  const day = new Date(`${dayStr}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return false;
  return Date.now() >= day.getTime() + 24 * 60 * 60 * 1000;
}
