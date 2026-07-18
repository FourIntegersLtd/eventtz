"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchStripePaymentsStatus,
  postConnectStripeAccount,
  type VendorPaymentsStatus,
} from "@/lib/vendorPaymentsApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export function isVendorPayoutsReady(status: VendorPaymentsStatus | null | undefined): boolean {
  return Boolean(status?.charges_enabled && status?.payouts_enabled);
}

/**
 * Shared Stripe Connect readiness for vendor dashboard / bookings.
 * `refresh` syncs flags from Stripe (same as GET /vendor/payments/status).
 */
export function useVendorPayoutsReady(enabled = true) {
  const [status, setStatus] = useState<VendorPaymentsStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStripePaymentsStatus();
      setStatus(res);
      return res;
    } catch {
      setError("Could not load your payout status.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const connectPayouts = useCallback(async (returnPath: string) => {
    setConnecting(true);
    setError(null);
    try {
      track(MixpanelEvents.vendor_payout_setup_started, {
        source: returnPath.includes("/bookings") ? "bookings" : "payments",
        return_path: returnPath,
      });
      const { onboarding_url } = await postConnectStripeAccount(returnPath);
      window.location.href = onboarding_url;
    } catch {
      setError("We couldn't start payout setup. Please try again.");
      setConnecting(false);
    }
  }, []);

  return {
    status,
    loading,
    connecting,
    error,
    setError,
    payoutsReady: isVendorPayoutsReady(status),
    refresh,
    connectPayouts,
  };
}
