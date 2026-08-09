"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  VendorPayoutCard,
  VendorPayoutSecurityNote,
  VendorPayoutSteps,
} from "@/features/vendor/payments/VendorPayoutCard";
import type { VendorPaymentsStatus } from "@/lib/vendorPaymentsApi";

type VendorPayoutAccountPanelProps = {
  status: VendorPaymentsStatus | null;
  loading: boolean;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
};

export function VendorPayoutAccountPanel({
  status,
  loading,
  connecting,
  error,
  onConnect,
}: VendorPayoutAccountPanelProps) {
  const started = Boolean(status?.stripe_account_id);
  const payoutsReady = Boolean(status?.charges_enabled && status?.payouts_enabled);

  const primaryLabel = connecting
    ? "Opening Stripe…"
    : payoutsReady
      ? "Manage on Stripe"
      : started
        ? "Continue setup"
        : "Set up payouts";

  const headline = payoutsReady
    ? "You're ready to get paid"
    : started
      ? "Almost there — finish verification"
      : "Connect your payout account";

  const subcopy = payoutsReady
    ? "Booking payouts will land in your linked account after each completed job."
    : started
      ? "Stripe is reviewing your details. Pick up where you left off to go live."
      : "Link a UK bank account through Stripe so clients can pay you securely on Eventtz.";

  return (
    <div className="grid w-full gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
      <div className="space-y-5">
        <VendorPayoutCard status={status} loading={loading} />

        {loading ? (
          <LoadingState label="Loading payout status…" variant="inline" />
        ) : (
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold text-neutral-900">{headline}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{subcopy}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                variant="primary"
                loading={connecting}
                onClick={onConnect}
                className="w-full sm:w-auto"
                icon={!connecting ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : undefined}
              >
                {primaryLabel}
              </Button>
              {payoutsReady ? (
                <p className="text-xs text-neutral-500">
                  Update sort code or account details anytime on Stripe.
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 ring-1 ring-red-200/80">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <VendorPayoutSecurityNote />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-neutral-900">Setup progress</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {payoutsReady
              ? "All steps complete — you can accept paid bookings."
              : "Complete each step to appear in search and receive payouts."}
          </p>
        </div>
        <VendorPayoutSteps status={loading ? null : status} />
      </div>
    </div>
  );
}
