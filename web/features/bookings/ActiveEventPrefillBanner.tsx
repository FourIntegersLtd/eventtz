"use client";

import { CalendarHeart, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";
import type { ClientEventPrefill } from "@/lib/clientEventsApi";
import { formatEventDate } from "@/lib/dateFormat";

type ActiveEventPrefillBannerProps = {
  prefill: ClientEventPrefill;
  onUse: () => void;
  onNewEvent: () => void;
};

export function ActiveEventPrefillBanner({
  prefill,
  onUse,
  onNewEvent,
}: ActiveEventPrefillBannerProps) {
  const dateLabel = formatEventDate(prefill.eventDate);

  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 pr-12">
      <button
        type="button"
        onClick={onNewEvent}
        className={`absolute right-1 top-1 inline-flex ${TOUCH_TARGET} items-center justify-center rounded-lg text-ink-3 hover:bg-white/70 hover:text-ink ${FOCUS_RING}`}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex gap-3">
        <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Planning the same event?</p>
          <p className="mt-0.5 text-sm text-ink-2">
            <span className="font-medium text-ink">{prefill.eventName}</span>
            {dateLabel ? ` · ${dateLabel}` : null}
          </p>
          <div className="mt-3">
            <Button type="button" variant="primary" size="sm" onClick={onUse}>
              Use these details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
