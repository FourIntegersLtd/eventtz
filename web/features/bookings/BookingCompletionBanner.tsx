"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
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
  /** While a problem report is open the payout is held, so the confirm button is hidden. */
  hasOpenDispute?: boolean;
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
  hasOpenDispute,
}: BookingCompletionBannerProps) {
  if (status !== "accepted" || paymentStatus !== "paid" || !waitingOn) return null;
  if (!eventDayOver(eventDate, eventEndDate)) return null;

  const copy = completionWaitingCopy(waitingOn, viewer);
  const viewerNeedsToConfirm = waitingOn === "both" || waitingOn === viewer;
  const showConfirm = viewerNeedsToConfirm && Boolean(onConfirm) && !hasOpenDispute;
  const release = autoReleaseAt ? autoReleaseLine(autoReleaseAt, viewer) : null;

  if (viewer === "vendor") {
    return (
      <Banner
        tone="brand"
        title={copy.title}
        action={
          showConfirm ? (
            <Button type="button" disabled={confirmDisabled} onClick={() => onConfirm?.()}>
              Mark as complete
            </Button>
          ) : null
        }
      >
        {copy.body}
        {release ? ` ${release}` : ""}
      </Banner>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.03]">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <LottieIllustration
            asset={viewerNeedsToConfirm ? "pendingReview" : "successCheck"}
            className="h-16 w-16 shrink-0"
            ariaLabel=""
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{copy.title}</p>
            <p className="mt-1 text-[13px] text-ink-2">{copy.body}</p>
            {autoReleaseAt ? (
              <p className="mt-1.5 text-[13px] text-ink-3">
                {autoReleaseLine(autoReleaseAt, viewer)}
              </p>
            ) : null}
          </div>
        </div>
        {showConfirm ? (
          <Button
            variant="primary"
            size="md"
            className="shrink-0"
            disabled={confirmDisabled}
            onClick={() => onConfirm?.()}
          >
            Confirm event complete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
