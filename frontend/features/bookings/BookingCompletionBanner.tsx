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
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 pb-4 pt-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-950">{copy.title}</p>
          <p className="mt-1 text-sm text-sky-900/90">{copy.body}</p>
          {autoReleaseAt ? (
            <p className="mt-2 text-xs text-sky-900/75">
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
