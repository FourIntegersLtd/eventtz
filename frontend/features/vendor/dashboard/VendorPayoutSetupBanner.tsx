"use client";

import { Button } from "@/components/ui/Button";

type VendorPayoutSetupBannerProps = {
  payoutsReady: boolean | null;
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
};

/**
 * Persistent prompt to finish Stripe Connect. Shown until payouts are ready.
 */
export function VendorPayoutSetupBanner({
  payoutsReady,
  loading,
  connecting,
  onConnect,
}: VendorPayoutSetupBannerProps) {
  if (loading || payoutsReady !== false) return null;

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-4 shadow-sm sm:px-5">
      <h2 className="font-heading text-base font-semibold text-amber-950">
        Your profile is hidden from clients
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
        Complete payout setup to appear in search and start accepting bookings. Clients can&apos;t
        find or contact you until your payout details are verified.
      </p>
      <div className="mt-3">
        <Button variant="primary" size="sm" loading={connecting} onClick={onConnect}>
          {connecting ? "Opening Stripe…" : "Connect payouts"}
        </Button>
      </div>
    </div>
  );
}
