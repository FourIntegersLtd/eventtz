"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RealtimeBusEvent } from "@/lib/realtimeBus";
import { realtimeBus } from "@/lib/realtimeBus";

export function useRealtimeSubscription(
  events: RealtimeBusEvent | RealtimeBusEvent[],
  handler: () => void,
  deps: unknown[],
) {
  const evs = useMemo(() => (Array.isArray(events) ? events : [events]), [events]);
  useEffect(() => {
    const unsubs = evs.map((ev) => realtimeBus.on(ev, () => handler()));
    return () => {
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handler, ...deps, ...evs]);
}

export function useRealtimeRefresh(
  events: RealtimeBusEvent | RealtimeBusEvent[],
  refresh: () => void,
  deps: unknown[],
  opts?: { debounceMs?: number },
) {
  const debounceMs = opts?.debounceMs ?? 200;
  const timerRef = useRef<number | null>(null);

  useRealtimeSubscription(
    events,
    () => {
      if (typeof window === "undefined") return;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        refresh();
      }, debounceMs);
    },
    deps,
  );

  useEffect(() => {
    return () => {
      if (timerRef.current != null && typeof window !== "undefined") {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };
  }, []);
}

