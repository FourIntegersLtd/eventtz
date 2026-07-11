export type RealtimeBusEvent =
  | "chat:unread_refresh"
  | "chat:data_refresh"
  | "booking_notifications:refresh"
  | "bookings:refresh"
  | "disputes:refresh";

type Handler<T = unknown> = (payload: T) => void;

type EventPayloads = {
  "chat:unread_refresh": {};
  "chat:data_refresh": {};
  "booking_notifications:refresh": {};
  "bookings:refresh": {};
  "disputes:refresh": {};
};

function getBus(): EventTarget {
  const g = globalThis as unknown as { __eventtz_realtime_bus__?: EventTarget };
  if (!g.__eventtz_realtime_bus__) {
    g.__eventtz_realtime_bus__ = new EventTarget();
  }
  return g.__eventtz_realtime_bus__;
}

export const realtimeBus = {
  emit<E extends RealtimeBusEvent>(event: E, payload?: Partial<EventPayloads[E]>) {
    getBus().dispatchEvent(new CustomEvent(event, { detail: payload ?? {} }));
  },

  on<E extends RealtimeBusEvent>(event: E, handler: Handler<EventPayloads[E]>) {
    const wrapped = (e: Event) => {
      const ce = e as CustomEvent;
      handler((ce.detail ?? {}) as EventPayloads[E]);
    };
    getBus().addEventListener(event, wrapped as EventListener);
    return () => getBus().removeEventListener(event, wrapped as EventListener);
  },
} as const;

