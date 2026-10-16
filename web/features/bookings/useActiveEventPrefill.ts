"use client";

import { useCallback, useEffect, useState } from "react";
import {
  eventToPrefill,
  fetchClientEventById,
  fetchClientEvents,
  pickPrimaryClientEvent,
  setSkipEventPrefillForSession,
  shouldSkipEventPrefillPrompt,
  type ClientEventPrefill,
} from "@/lib/clientEventsApi";

type UseActiveEventPrefillOptions = {
  /** When set (e.g. planner handoff), load and auto-apply without showing the banner. */
  linkedEventId?: string | null;
};

export function useActiveEventPrefill(options?: UseActiveEventPrefillOptions) {
  const linkedEventId = options?.linkedEventId?.trim() || null;
  const [pendingPrefill, setPendingPrefill] = useState<ClientEventPrefill | null>(null);
  const [linkedPrefill, setLinkedPrefill] = useState<ClientEventPrefill | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(linkedEventId);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    if (linkedEventId) {
      void fetchClientEventById(linkedEventId)
        .then((event) => {
          if (!event) return;
          const prefill = eventToPrefill(event);
          setLinkedPrefill(prefill);
          setSelectedEventId(prefill.eventId);
          setBannerVisible(false);
        })
        .catch(() => {
          /* non-fatal */
        });
      return;
    }
    if (shouldSkipEventPrefillPrompt()) return;
    void fetchClientEvents("active")
      .then((events) => {
        const primary = pickPrimaryClientEvent(events);
        if (!primary) return;
        setPendingPrefill(eventToPrefill(primary));
        setBannerVisible(true);
      })
      .catch(() => {
        /* non-fatal */
      });
  }, [linkedEventId]);

  const applyPrefill = useCallback((prefill: ClientEventPrefill) => {
    setSelectedEventId(prefill.eventId);
    setBannerVisible(false);
    setSkipEventPrefillForSession(false);
    return prefill;
  }, []);

  const dismissForNewEvent = useCallback(() => {
    setSelectedEventId(null);
    setLinkedPrefill(null);
    setBannerVisible(false);
    setSkipEventPrefillForSession(true);
  }, []);

  return {
    pendingPrefill,
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    applyPrefill,
    dismissForNewEvent,
  };
}

export type ActiveEventPrefillFields = {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
};

export function applyPrefillToFields(prefill: ClientEventPrefill): ActiveEventPrefillFields {
  return {
    eventName: prefill.eventName,
    eventDate: prefill.eventDate,
    eventEndDate: prefill.eventEndDate,
    venueAddress: prefill.venueAddress,
  };
}

export function applyLinkedPrefillToForm(
  linkedPrefill: ClientEventPrefill | null,
  setters: {
    setEventName: (v: string) => void;
    setEventDate: (v: string) => void;
    setEventEndDate: (v: string) => void;
    setVenueAddress: (v: string) => void;
  },
): void {
  if (!linkedPrefill) return;
  setters.setEventName(linkedPrefill.eventName);
  setters.setEventDate(linkedPrefill.eventDate);
  setters.setEventEndDate(linkedPrefill.eventEndDate);
  setters.setVenueAddress(linkedPrefill.venueAddress);
}
