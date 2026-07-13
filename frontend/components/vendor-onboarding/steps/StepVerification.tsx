import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { STEP_COPY } from "../onboardingCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import type { VendorPaymentsStatus } from "@/lib/vendorPaymentsApi";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";

export type StepVerificationProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  stripeStatus?: VendorPaymentsStatus | null;
  connectingStripe?: boolean;
  stripeConnectError?: string | null;
  onConnectStripe?: () => void | Promise<void>;
};

export function StepVerification({
  data,
  stripeStatus,
  connectingStripe,
  stripeConnectError,
  onConnectStripe,
}: StepVerificationProps) {
  const copy = STEP_COPY[7];
  const payoutsReady = Boolean(stripeStatus?.charges_enabled && stripeStatus?.payouts_enabled);
  const started = data.stripeConnectStarted || Boolean(stripeStatus?.stripe_account_id);

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout headline={copy.headline} subtext={copy.subtext} />
      <OnboardingSubQuestion headline="Connect your payout account" indexOffset={3}>
        <div className={`${portalCard} ${portalCardPadding}`}>
          {payoutsReady ? (
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Stripe verified. You can receive payouts.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void onConnectStripe?.()}
                disabled={connectingStripe}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60"
              >
                {connectingStripe
                  ? "Redirecting to Stripe…"
                  : started
                    ? "Continue payout setup"
                    : "Set up payouts"}
              </button>
              {stripeConnectError && (
                <p className="mt-4 text-sm font-medium text-red-700">{stripeConnectError}</p>
              )}
              {!stripeConnectError && started && (
                <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  Stripe Connect started. Finish verification on Stripe to receive payouts.
                </p>
              )}
            </>
          )}
          {payoutsReady ? (
            <button
              type="button"
              onClick={() => void onConnectStripe?.()}
              disabled={connectingStripe}
              className="mt-4 text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline disabled:opacity-60"
            >
              {connectingStripe ? "Opening Stripe…" : "Update bank details on Stripe"}
            </button>
          ) : null}
        </div>
      </OnboardingSubQuestion>
    </div>
  );
}
