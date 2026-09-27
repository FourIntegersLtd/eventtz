"use client";

import { useEffect, useRef } from "react";
import { platformApiUrl } from "@/foundation/platform-client";
import { requestStreamTicket } from "@/capabilities/realtime-stream/api";

/**
 * The named SSE frames the platform API relays (`api/app/features/realtime/router.py`'s
 * docstring, and the baseline's `frontend/lib/useRealtimeSse.ts`, which this hook
 * replaces). Each frame carries no payload — it just names what changed, and the
 * listener re-fetches through its own domain's `api.ts`.
 */
export type RealtimeEventName =
  | "connected"
  | "chat_unread_changed"
  | "booking_notifications_changed"
  | "booking_changed"
  | "dispute_changed";

// How long to wait before opening a new stream after one drops. A flat delay
// rather than exponential backoff: this is a single browser tab reconnecting
// to its own account's stream, not a fleet of clients hammering the API.
const RECONNECT_DELAY_MS = 4000;

/**
 * Subscribe to the signed-in caller's live event stream while this component
 * is mounted.
 *
 * Mints a fresh ticket and opens `EventSource` on `/api/v1/realtime/stream`,
 * calls `onEvent` for every frame whose name is in `eventNames`, and retries
 * a dropped connection after `RECONNECT_DELAY_MS`. Used by the messages and
 * notifications domains to refetch their list without a manual reload.
 *
 * `enabled: false` (e.g. while the caller isn't signed in yet) tears down
 * any open connection and does not open a new one.
 */
export function useRealtimeStream(
  eventNames: readonly RealtimeEventName[],
  onEvent: (eventName: RealtimeEventName) => void,
  enabled = true,
): void {
  // Refs, not state: a reconnect must always see the latest callback and
  // event list without re-running the connect effect on every render. The
  // assignment happens in its own effect, not during render, since mutating
  // a ref while rendering is unsafe under React's concurrent renderer.
  const onEventRef = useRef(onEvent);
  const eventNamesRef = useRef(eventNames);
  useEffect(() => {
    onEventRef.current = onEvent;
    eventNamesRef.current = eventNames;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const attachedListeners: { name: string; handler: EventListener }[] = [];

    async function connect() {
      try {
        const { ticket } = await requestStreamTicket();
        if (cancelled) return;
        const url = `${platformApiUrl()}/api/v1/realtime/stream?ticket=${encodeURIComponent(ticket)}`;
        const es = new EventSource(url);
        source = es;

        for (const eventName of eventNamesRef.current) {
          const handler = () => onEventRef.current(eventName);
          es.addEventListener(eventName, handler);
          attachedListeners.push({ name: eventName, handler });
        }

        es.onerror = () => {
          es.close();
          if (source === es) source = null;
          if (!cancelled) reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
        };
      } catch {
        // Minting a ticket failed (signed out, offline). Try again shortly
        // rather than leaving the tab silently disconnected forever.
        if (!cancelled) reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (source) {
        for (const { name, handler } of attachedListeners) source.removeEventListener(name, handler);
        source.close();
      }
    };
    // `eventNames`/`onEvent` are read through refs above so the stream is not
    // torn down and reopened on every render of the calling component.
  }, [enabled]);
}
