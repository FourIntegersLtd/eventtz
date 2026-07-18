"use client";

import { useEffect, useRef } from "react";
import { realtimeBus } from "@/lib/realtimeBus";

/**
 * Open a per-user SSE stream. Pass the signed-in user id (not just a boolean) so
 * switching accounts reconnects — otherwise events for the previous user keep
 * firing refresh on the new session's dashboard.
 */
export function useRealtimeSse(userId: string | null | undefined) {
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) {
      if (ref.current) {
        ref.current.close();
        ref.current = null;
      }
      return;
    }
    if (typeof window === "undefined") return;

    const es = new EventSource("/api/realtime/stream");
    ref.current = es;

    const onChatUnread = () => {
      realtimeBus.emit("chat:unread_refresh");
      realtimeBus.emit("chat:data_refresh");
    };
    const onBookingNotifs = () => {
      realtimeBus.emit("booking_notifications:refresh");
    };
    const onBookingChanged = () => {
      realtimeBus.emit("bookings:refresh");
    };
    const onDisputeChanged = () => {
      realtimeBus.emit("disputes:refresh");
    };

    es.addEventListener("chat_unread_changed", onChatUnread as EventListener);
    es.addEventListener("booking_notifications_changed", onBookingNotifs as EventListener);
    es.addEventListener("booking_changed", onBookingChanged as EventListener);
    es.addEventListener("dispute_changed", onDisputeChanged as EventListener);

    es.onerror = () => {
      // Browser will retry automatically.
    };

    return () => {
      es.removeEventListener("chat_unread_changed", onChatUnread as EventListener);
      es.removeEventListener("booking_notifications_changed", onBookingNotifs as EventListener);
      es.removeEventListener("booking_changed", onBookingChanged as EventListener);
      es.removeEventListener("dispute_changed", onDisputeChanged as EventListener);
      es.close();
      if (ref.current === es) ref.current = null;
    };
  }, [userId]);
}
