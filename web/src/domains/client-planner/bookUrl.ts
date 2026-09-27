/**
 * Query-param names the planner puts on a vendor profile URL, and the
 * event-form defaults those params are filled from.
 *
 * Piece 11 (browse) reads these same names. `dates`, `fromPlanner`, and
 * `event_id` are the baseline's literal keys; the `PLAN_*` trio are the
 * event-form fields from `eventEnquirePrefill.ts`.
 */
import type { components } from "@/foundation/platform-client";

export const PLAN_EVENT_NAME = "eventName";
export const PLAN_VENUE = "venue";
export const PLAN_NOTES = "planNotes";
export const PLAN_DATES = "dates";
export const PLAN_FROM_PLANNER = "fromPlanner";
export const PLAN_EVENT_ID = "event_id";

/** The baseline omits `country` when it is this UK default. */
export const DEFAULT_COUNTRY_CODE = "GB";

export type PlanDetail = components["schemas"]["PlanDetailResponse"];

/** Booking-form defaults taken from a celebration plan. */
export interface EventEnquirePrefill {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
  notes: string;
}

/** Local calendar date as `YYYY-MM-DD`, used when the plan's date is missing or invalid. */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Map a celebration plan onto the booking form's event fields.
 *
 * An invalid or missing preferred date becomes today, matching the baseline:
 * the client confirms the real date when they enquire. `now` is injectable
 * so that fallback is testable without freezing the clock.
 */
export function eventPrefillFromCelebrationPlan(plan: PlanDetail, now: Date = new Date()): EventEnquirePrefill {
  const celebration = plan.celebration;
  const brief = plan.brief;
  const noteParts: string[] = [];
  if (brief.guest_count) noteParts.push(`${brief.guest_count} guests`);
  const specialRequirements = brief.special_requirements?.trim();
  if (specialRequirements) noteParts.push(specialRequirements);
  const cuisineNotes = brief.cuisine_notes?.trim();
  if (cuisineNotes) noteParts.push(`Cuisine: ${cuisineNotes}`);
  const musicNotes = brief.music_notes?.trim();
  if (musicNotes) noteParts.push(`Music: ${musicNotes}`);

  const preferred = celebration.preferred_date?.trim() || brief.preferred_date?.trim() || "";
  const eventDate = preferred && !brief.preferred_date_invalid ? preferred.slice(0, 10) : todayIsoDate(now);

  return {
    eventName: celebration.title?.trim() || "My celebration",
    eventDate,
    eventEndDate: "",
    venueAddress: celebration.location?.trim() || brief.location?.trim() || "",
    notes: noteParts.join("\n"),
  };
}

/**
 * `/client/browse/{vendorUserId}` with the plan's event fields in the query.
 *
 * Blank fields are left out. `fromPlanner` is always set so browse can tell
 * this visit came from a plan. `event_id` is set only once a client event exists.
 */
export function buildPlannerVendorBookUrl(
  vendorUserId: string,
  plan: PlanDetail,
  linkedEventId?: string | null,
): string {
  const prefill = eventPrefillFromCelebrationPlan(plan);
  const params = new URLSearchParams();
  if (prefill.eventName) params.set(PLAN_EVENT_NAME, prefill.eventName);
  if (prefill.eventDate) params.set(PLAN_DATES, prefill.eventDate);
  if (prefill.venueAddress) params.set(PLAN_VENUE, prefill.venueAddress);
  if (prefill.notes) params.set(PLAN_NOTES, prefill.notes);
  params.set(PLAN_FROM_PLANNER, plan.plan_id);
  const eventId = linkedEventId?.trim();
  if (eventId) params.set(PLAN_EVENT_ID, eventId);
  const query = params.toString();
  return `/client/browse/${encodeURIComponent(vendorUserId)}${query ? `?${query}` : ""}`;
}
