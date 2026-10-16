"use client";

import { Button } from "@/components/ui/Button";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { PAYMENT_FLOW_COPY } from "@/features/bookings/bookingConfirmCopy";

type BookingPayoutPendingBannerProps = {
  viewer: "client" | "vendor";
  onRetryRelease?: () => void;
  retryDisabled?: boolean;
  retryLoading?: boolean;
};

/**
 * Both parties confirmed completion but Stripe has not marked the payout released yet.
 * Usually means a transfer failed once and needs a retry after a backend fix.
 */
export function BookingPayoutPendingBanner({
  viewer,
  onRetryRelease,
  retryDisabled,
  retryLoading,
}: BookingPayoutPendingBannerProps) {
  const copy =
    viewer === "vendor"
      ? PAYMENT_FLOW_COPY.payoutPendingVendor
      : PAYMENT_FLOW_COPY.payoutPendingClient;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/80">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <LottieIllustration asset="pendingReview" className="h-16 w-16 shrink-0" ariaLabel="" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">{copy.title}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{copy.body}</p>
          </div>
        </div>
        {viewer === "vendor" && onRetryRelease ? (
          <Button
            variant="primary"
            size="md"
            className="shrink-0"
            disabled={retryDisabled}
            loading={retryLoading}
            onClick={onRetryRelease}
          >
            {retryLoading ? "Releasing…" : "Release my payout"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
