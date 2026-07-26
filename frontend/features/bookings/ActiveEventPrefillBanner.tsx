"use client";

import { CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
      <div className="flex gap-3">
        <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">Planning the same event?</p>
          <p className="mt-0.5 text-sm text-neutral-600">
            <span className="font-medium text-neutral-800">{prefill.eventName}</span>
            {dateLabel ? ` · ${dateLabel}` : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={onUse}>
              Use these details
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onNewEvent}>
              New event
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
