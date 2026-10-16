import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { todayIsoDate } from "@/lib/eventDateValidation";

/** Shared event fields for booking enquire modals (planner, browse, client_events). */
export type EventEnquirePrefill = {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
  notes: string;
  eventId?: string | null;
};

const PLAN_EVENT_NAME = "eventName";
const PLAN_VENUE = "venue";
const PLAN_NOTES = "planNotes";

/** Map an AI celebration plan to booking form defaults. */
export function eventPrefillFromCelebrationPlan(
  plan: CelebrationPlanResponse,
): EventEnquirePrefill {
  const c = plan.celebration;
  const b = plan.brief;
  const noteParts: string[] = [];
  if (b.guest_count) noteParts.push(`${b.guest_count} guests`);
  if (b.special_requirements?.trim()) noteParts.push(b.special_requirements.trim());
  if (b.cuisine_notes?.trim()) noteParts.push(`Cuisine: ${b.cuisine_notes.trim()}`);
  if (b.music_notes?.trim()) noteParts.push(`Music: ${b.music_notes.trim()}`);

  const preferred = c.preferred_date?.trim() || b.preferred_date?.trim() || "";
  const eventDate =
    preferred && !b.preferred_date_invalid ? preferred.slice(0, 10) : todayIsoDate();

  return {
    eventName: c.title?.trim() || "My celebration",
    eventDate,
    eventEndDate: "",
    venueAddress: c.location?.trim() || b.location?.trim() || "",
    notes: noteParts.join("\n"),
  };
}

/** Browse vendor profile URL with plan event fields in query params. */
export function buildPlannerVendorBookUrl(
  vendorUserId: string,
  plan: CelebrationPlanResponse,
  linkedEventId?: string | null,
): string {
  const prefill = eventPrefillFromCelebrationPlan(plan);
  const sp = new URLSearchParams();
  if (prefill.eventName) sp.set(PLAN_EVENT_NAME, prefill.eventName);
  if (prefill.eventDate) sp.set("dates", prefill.eventDate);
  if (prefill.venueAddress) sp.set(PLAN_VENUE, prefill.venueAddress);
  if (prefill.notes) sp.set(PLAN_NOTES, prefill.notes);
  sp.set("fromPlanner", plan.plan_id);
  if (linkedEventId?.trim()) sp.set("event_id", linkedEventId.trim());
  const qs = sp.toString();
  return `/client/browse/${encodeURIComponent(vendorUserId)}${qs ? `?${qs}` : ""}`;
}

/** Read planner/booking prefill params on vendor browse detail. */
export function eventEnquirePrefillFromSearchParams(
  sp: URLSearchParams,
): EventEnquirePrefill | null {
  const eventName = sp.get(PLAN_EVENT_NAME)?.trim() ?? "";
  const venueAddress = sp.get(PLAN_VENUE)?.trim() ?? "";
  const notes = sp.get(PLAN_NOTES)?.trim() ?? "";
  const datesRaw = sp.get("dates")?.trim() ?? "";
  const eventDate = datesRaw.split(",")[0]?.trim() ?? "";
  const eventEndDate = datesRaw.split(",")[1]?.trim() ?? "";
  if (!eventName && !eventDate && !venueAddress && !notes) return null;
  return {
    eventName,
    eventDate,
    eventEndDate,
    venueAddress,
    notes,
  };
}

export function applyEventEnquirePrefill(
  prefill: EventEnquirePrefill,
  current: EventEnquirePrefill,
): EventEnquirePrefill {
  return {
    eventName: prefill.eventName || current.eventName,
    eventDate: prefill.eventDate || current.eventDate,
    eventEndDate: prefill.eventEndDate || current.eventEndDate,
    venueAddress: prefill.venueAddress || current.venueAddress,
    notes: prefill.notes || current.notes,
    eventId: prefill.eventId ?? current.eventId ?? null,
  };
}
