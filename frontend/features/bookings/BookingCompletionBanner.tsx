"use client";

import { Button } from "@/components/ui/Button";
import {
  autoReleaseLine,
  completionWaitingCopy,
} from "@/features/bookings/bookingConfirmCopy";
import { eventDayOver } from "@/features/bookings/eventDay";

type BookingCompletionBannerProps = {
  viewer: "client" | "vendor";
  status: string;
  paymentStatus: string;
  eventDate: string;
  eventEndDate: string | null;
  waitingOn: "client" | "vendor" | "both" | null | undefined;
  autoReleaseAt: string | null | undefined;
  /** Opens the confirm-completion dialog when the viewer still needs to confirm. */
  onConfirm?: () => void;
  confirmDisabled?: boolean;
};

/**
 * Post-event nudge: shows who we're waiting on to confirm the event went well,
 * plus the automatic payout date. Renders nothing until the event day is over.
 */
export function BookingCompletionBanner({
  viewer,
  status,
  paymentStatus,
  eventDate,
  eventEndDate,
  waitingOn,
  autoReleaseAt,
  onConfirm,
  confirmDisabled,
}: BookingCompletionBannerProps) {
  if (status !== "accepted" || paymentStatus !== "paid" || !waitingOn) return null;
  if (!eventDayOver(eventDate, eventEndDate)) return null;

  const copy = completionWaitingCopy(waitingOn, viewer);
  const viewerNeedsToConfirm = waitingOn === "both" || waitingOn === viewer;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{copy.title}</p>
          <p className="mt-1 text-[13px] text-neutral-600">{copy.body}</p>
          {autoReleaseAt ? (
            <p className="mt-1.5 text-[13px] text-neutral-400">
              {autoReleaseLine(autoReleaseAt, viewer)}
            </p>
          ) : null}
        </div>
        {viewerNeedsToConfirm && onConfirm ? (
          <Button
            variant="primary"
            size="md"
            className="shrink-0"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            Confirm event complete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
