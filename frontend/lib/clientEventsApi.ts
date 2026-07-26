import api from "@/lib/axios";

export type ClientEventSummary = {
  id: string;
  title: string;
  event_date: string;
  event_end_date: string | null;
  event_address: string | null;
  event_postcode: string | null;
  status: "active" | "archived";
  booking_count: number;
  active_booking_count: number;
  updated_at: string | null;
};

export type ClientEventsListResponse = {
  success: boolean;
  events: ClientEventSummary[];
};

export async function fetchClientEvents(
  status: "active" | "archived" | "all" = "active",
): Promise<ClientEventSummary[]> {
  const { data } = await api.get<ClientEventsListResponse>("/api/v1/client/events", {
    params: { status },
  });
  return data.events ?? [];
}

export type ClientEventDetailResponse = {
  success: boolean;
  event: ClientEventSummary & { created_at: string | null };
};

export async function fetchClientEventById(eventId: string): Promise<ClientEventSummary | null> {
  try {
    const { data } = await api.get<ClientEventDetailResponse>(
      `/api/v1/client/events/${encodeURIComponent(eventId)}`,
    );
    return data.event ?? null;
  } catch {
    return null;
  }
}

export type ClientEventPrefill = {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
};

export function eventToPrefill(event: ClientEventSummary): ClientEventPrefill {
  return {
    eventId: event.id,
    eventName: event.title,
    eventDate: event.event_date,
    eventEndDate: event.event_end_date ?? "",
    venueAddress: event.event_address ?? "",
  };
}

/** Primary active event: most active bookings, then most recently updated. */
export function pickPrimaryClientEvent(events: ClientEventSummary[]): ClientEventSummary | null {
  const active = events.filter((e) => e.status === "active");
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const ac = b.active_booking_count - a.active_booking_count;
    if (ac !== 0) return ac;
    const bc = b.booking_count - a.booking_count;
    if (bc !== 0) return bc;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  })[0] ?? null;
}

const SKIP_PREFILL_KEY = "eventtz.skip_event_prefill";

export function setSkipEventPrefillForSession(skip: boolean): void {
  try {
    if (skip) sessionStorage.setItem(SKIP_PREFILL_KEY, "1");
    else sessionStorage.removeItem(SKIP_PREFILL_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldSkipEventPrefillPrompt(): boolean {
  try {
    return sessionStorage.getItem(SKIP_PREFILL_KEY) === "1";
  } catch {
    return false;
  }
}
