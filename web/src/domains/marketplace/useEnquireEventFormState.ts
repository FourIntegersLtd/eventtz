"use client";

/**
 * Event name, dates, venue, and notes for the booking modal.
 * A linked `event_id` is loaded and applied. Otherwise the client's busiest
 * active event is offered, unless this tab already dismissed that prompt.
 */
import { useEffect, useState } from "react";
import { fetchClientEventById, fetchClientEvents } from "./api";
import { isPastIsoDate, todayIsoDate } from "./bookingRequestValidation";
import {
  eventToPrefill,
  pickPrimaryClientEvent,
  setSkipEventPrefillForSession,
  shouldSkipEventPrefillPrompt,
  type ClientEventForPrefill,
  type ClientEventPrefill,
} from "./clientEventPrefill";
import type { EventEnquirePrefill, MarketplaceBookingSearchPrefill } from "./marketplaceSearchParams";

type UseEnquireEventFormStateArgs = {
  searchPrefill?: MarketplaceBookingSearchPrefill;
  initialPrefill?: EventEnquirePrefill | null;
  linkedEventId?: string | null;
};

type FieldDraft = {
  eventName?: string;
  eventDate?: string;
  eventEndDate?: string;
  venueAddress?: string;
  notes?: string;
};

type EventsLoad = {
  key: string;
  events: ClientEventForPrefill[];
};

/** Form fields plus the event id that should be stored on the booking. */
export function useEnquireEventFormState({
  searchPrefill,
  initialPrefill,
  linkedEventId,
}: UseEnquireEventFormStateArgs) {
  const linkedId = linkedEventId?.trim() || null;
  const loadKey = linkedId ?? "active";
  const [eventsResult, setEventsResult] = useState<EventsLoad | null>(null);
  const [draft, setDraft] = useState<FieldDraft>({});
  const [pickedEventId, setPickedEventId] = useState<string | null | undefined>(undefined);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!linkedId && shouldSkipEventPrefillPrompt()) return;
    let cancelled = false;
    const key = loadKey;
    const request = linkedId
      ? fetchClientEventById(linkedId).then((event) => (event ? [event] : []))
      : fetchClientEvents("active");
    request
      .then((events) => {
        if (cancelled) return;
        setEventsResult({
          key,
          events: events.map((event) => ({
            id: event.id,
            title: event.title,
            event_date: event.event_date,
            event_end_date: event.event_end_date,
            event_address: event.event_address,
            status: event.status,
            booking_count: event.booking_count,
            active_booking_count: event.active_booking_count,
            updated_at: "updated_at" in event ? event.updated_at : event.created_at,
          })),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEventsResult({ key, events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [linkedId, loadKey]);

  const loaded = eventsResult?.key === loadKey ? eventsResult.events : [];
  const linkedPrefill = linkedId && loaded[0] ? eventToPrefill(loaded[0]) : null;
  const pendingPrefill = !linkedId ? eventToPrefillOrNull(pickPrimaryClientEvent(loaded)) : null;
  const bannerVisible = Boolean(pendingPrefill) && !bannerDismissed && !linkedId;

  const eventName =
    draft.eventName ??
    linkedPrefill?.eventName ??
    initialPrefill?.eventName ??
    "";
  const eventDate = draft.eventDate ?? fallbackEventDate(searchPrefill, initialPrefill, linkedPrefill);
  const eventEndDate =
    draft.eventEndDate ?? fallbackEventEndDate(searchPrefill, initialPrefill, linkedPrefill);
  const venueAddress =
    draft.venueAddress ?? linkedPrefill?.venueAddress ?? initialPrefill?.venueAddress ?? "";
  const notes = draft.notes ?? initialPrefill?.notes ?? "";
  const selectedEventId = pickedEventId !== undefined ? pickedEventId : linkedId;

  const setEventName = (value: string) => setDraft((prev) => ({ ...prev, eventName: value }));
  const setEventDate = (value: string) => setDraft((prev) => ({ ...prev, eventDate: value }));
  const setEventEndDate = (value: string) => setDraft((prev) => ({ ...prev, eventEndDate: value }));
  const setVenueAddress = (value: string) => setDraft((prev) => ({ ...prev, venueAddress: value }));
  const setNotes = (value: string) => setDraft((prev) => ({ ...prev, notes: value }));

  const applyBannerPrefill = () => {
    if (!pendingPrefill) return;
    setDraft({
      eventName: pendingPrefill.eventName,
      eventDate: pendingPrefill.eventDate,
      eventEndDate: pendingPrefill.eventEndDate,
      venueAddress: pendingPrefill.venueAddress,
    });
    setPickedEventId(pendingPrefill.eventId);
    setBannerDismissed(true);
    setSkipEventPrefillForSession(false);
  };

  const dismissForNewEvent = () => {
    setPickedEventId(null);
    setBannerDismissed(true);
    setSkipEventPrefillForSession(true);
  };

  return {
    eventName,
    setEventName,
    eventDate,
    setEventDate,
    eventEndDate,
    setEventEndDate,
    venueAddress,
    setVenueAddress,
    notes,
    setNotes,
    pendingPrefill,
    selectedEventId,
    bannerVisible,
    dismissForNewEvent,
    applyBannerPrefill,
  };
}

function eventToPrefillOrNull(event: ClientEventForPrefill | null): ClientEventPrefill | null {
  return event ? eventToPrefill(event) : null;
}

function fallbackEventDate(
  searchPrefill: MarketplaceBookingSearchPrefill | undefined,
  initialPrefill: EventEnquirePrefill | null | undefined,
  linkedPrefill: ClientEventPrefill | null,
): string {
  if (linkedPrefill?.eventDate) return linkedPrefill.eventDate;
  const fromSearch = searchPrefill?.eventDate?.trim() ?? "";
  if (fromSearch) return isPastIsoDate(fromSearch) ? "" : fromSearch;
  const fromInitial = initialPrefill?.eventDate?.trim() ?? "";
  if (fromInitial) return fromInitial;
  return todayIsoDate();
}

function fallbackEventEndDate(
  searchPrefill: MarketplaceBookingSearchPrefill | undefined,
  initialPrefill: EventEnquirePrefill | null | undefined,
  linkedPrefill: ClientEventPrefill | null,
): string {
  if (linkedPrefill) return linkedPrefill.eventEndDate;
  if (searchPrefill?.eventEndDate !== undefined) {
    const end = searchPrefill.eventEndDate ?? "";
    return end && isPastIsoDate(end) ? "" : end;
  }
  return initialPrefill?.eventEndDate ?? "";
}
