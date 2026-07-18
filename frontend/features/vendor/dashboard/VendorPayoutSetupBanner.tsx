"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";

const DISMISS_KEY = "vendor-payout-setup-banner-dismissed";

/**
 * Optional, dismissible prompt to finish Stripe Connect. Does not block the dashboard.
 */
export function VendorPayoutSetupBanner() {
  const { payoutsReady, loading, connecting, connectPayouts } = useVendorPayoutsReady(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (loading || payoutsReady || dismissed) return null;

  return (
    <div className="relative rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-4 shadow-sm sm:px-5">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // ignore
          }
          setDismissed(true);
        }}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-amber-800/70 transition hover:bg-amber-100 hover:text-amber-950"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="pr-8">
        <h2 className="font-heading text-base font-semibold text-amber-950">
          Accept secure payments
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
          Complete payout setup now so you can accept bookings instantly.
        </p>
        <div className="mt-3">
          <Button
            variant="primary"
            size="sm"
            loading={connecting}
            onClick={() => void connectPayouts("/vendor/payments")}
          >
            Connect payouts
          </Button>
        </div>
      </div>
    </div>
  );
}
