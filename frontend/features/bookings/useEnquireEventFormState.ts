"use client";

import { useEffect, useState } from "react";
import { isPastIsoDate, todayIsoDate } from "@/lib/eventDateValidation";
import type { MarketplaceBookingSearchPrefill } from "@/lib/marketplaceSearchParams";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import {
  applyPrefillToFields,
  applyLinkedPrefillToForm,
  useActiveEventPrefill,
} from "@/features/bookings/useActiveEventPrefill";

type UseEnquireEventFormStateArgs = {
  searchPrefill?: MarketplaceBookingSearchPrefill;
  initialPrefill?: EventEnquirePrefill | null;
  linkedEventId?: string | null;
};

export function useEnquireEventFormState({
  searchPrefill,
  initialPrefill,
  linkedEventId,
}: UseEnquireEventFormStateArgs) {
  const [eventName, setEventName] = useState(initialPrefill?.eventName ?? "");
  const [eventDate, setEventDate] = useState(
    searchPrefill?.eventDate?.trim() ||
      initialPrefill?.eventDate?.trim() ||
      todayIsoDate(),
  );
  const [eventEndDate, setEventEndDate] = useState(
    searchPrefill?.eventEndDate ?? initialPrefill?.eventEndDate ?? "",
  );
  const [venueAddress, setVenueAddress] = useState(initialPrefill?.venueAddress ?? "");
  const [notes, setNotes] = useState(initialPrefill?.notes ?? "");

  const {
    pendingPrefill,
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    applyPrefill,
    dismissForNewEvent,
  } = useActiveEventPrefill({ linkedEventId });

  useEffect(() => {
    if (searchPrefill?.eventDate) {
      const date = searchPrefill.eventDate;
      setEventDate(isPastIsoDate(date) ? "" : date);
    }
    if (searchPrefill?.eventEndDate !== undefined) {
      const end = searchPrefill.eventEndDate ?? "";
      setEventEndDate(end && isPastIsoDate(end) ? "" : end);
    }
  }, [searchPrefill?.eventDate, searchPrefill?.eventEndDate]);

  useEffect(() => {
    if (selectedEventId || bannerVisible || linkedPrefill || !initialPrefill) return;
    if (initialPrefill.eventName) setEventName(initialPrefill.eventName);
    if (initialPrefill.eventDate) setEventDate(initialPrefill.eventDate);
    if (initialPrefill.eventEndDate) setEventEndDate(initialPrefill.eventEndDate);
    if (initialPrefill.venueAddress) setVenueAddress(initialPrefill.venueAddress);
    if (initialPrefill.notes) setNotes(initialPrefill.notes);
  }, [initialPrefill, selectedEventId, bannerVisible, linkedPrefill]);

  useEffect(() => {
    applyLinkedPrefillToForm(linkedPrefill, {
      setEventName,
      setEventDate,
      setEventEndDate,
      setVenueAddress,
    });
  }, [linkedPrefill]);

  const applyBannerPrefill = () => {
    if (!pendingPrefill) return;
    const fields = applyPrefillToFields(applyPrefill(pendingPrefill));
    setEventName(fields.eventName);
    setEventDate(fields.eventDate);
    setEventEndDate(fields.eventEndDate);
    setVenueAddress(fields.venueAddress);
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
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    dismissForNewEvent,
    applyBannerPrefill,
  };
}
