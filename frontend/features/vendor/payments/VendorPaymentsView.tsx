"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  fetchStripePaymentsStatus,
  postConnectStripeAccount,
  type VendorPaymentsStatus,
} from "@/lib/vendorPaymentsApi";

/**
 * Standalone payout status + Stripe Connect entry point, reachable from the
 * portal nav at any time (not just during onboarding) — mirrors the copy and
 * flow of `StepVerification` but doesn't depend on onboarding form state.
 */
export function VendorPaymentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VendorPaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStripePaymentsStatus();
      setStatus(res);
    } catch {
      setError("Could not load your payout status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stripe");
    const next = params.toString();
    router.replace(next ? `/vendor/payments?${next}` : "/vendor/payments");
    void refresh();
  }, [searchParams, router, refresh]);

  const started = Boolean(status?.stripe_account_id);
  const payoutsReady = Boolean(status?.charges_enabled && status?.payouts_enabled);

  const onConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { onboarding_url } = await postConnectStripeAccount("/vendor/payments");
      window.location.href = onboarding_url;
    } catch {
      setError("We couldn't start payout setup. Please try again.");
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className={`${portalCard} ${portalCardPadding}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">
              Get paid for your bookings
            </h2>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading payout status…" variant="inline" className="mt-5" />
        ) : payoutsReady ? (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Stripe verified. You can receive payouts.
            </p>
            <button
              type="button"
              disabled={connecting}
              onClick={() => void onConnect()}
              className="mt-4 text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-60"
            >
              {connecting ? "Opening Stripe…" : "Update bank details on Stripe"}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <Button variant="primary" loading={connecting} onClick={() => void onConnect()} className="w-full sm:w-auto">
              {started ? "Continue payout setup" : "Set up payouts"}
            </Button>

            {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}

            {!error && started ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Finish payout setup to receive payments.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
