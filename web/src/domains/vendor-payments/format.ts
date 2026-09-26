import type { VendorPaymentsStatus } from "@/domains/vendor-payments/api";

/** The vendor's payout setup stage, in the order the setup panel walks through it. */
export type PayoutSetupStage = "not_started" | "in_progress" | "ready";

/**
 * Where the vendor's Stripe Connect account stands.
 *
 * `not_started`: no Stripe account created yet. `in_progress`: an account
 * exists but Stripe has not cleared it for both charges and payouts.
 * `ready`: both are enabled, so the vendor can accept paid bookings.
 */
export function payoutSetupStage(status: VendorPaymentsStatus | null): PayoutSetupStage {
  if (!status?.stripe_account_id) return "not_started";
  if (status.charges_enabled && status.payouts_enabled) return "ready";
  return "in_progress";
}

/** The headline shown above the connect/manage button, by setup stage. */
export function payoutSetupHeadline(stage: PayoutSetupStage): string {
  switch (stage) {
    case "ready":
      return "You're ready to get paid";
    case "in_progress":
      return "Almost there — finish verification";
    case "not_started":
      return "Connect your payout account";
  }
}

/** The primary button's label, by setup stage and whether a request is in flight. */
export function payoutConnectButtonLabel(stage: PayoutSetupStage, connecting: boolean): string {
  if (connecting) return "Opening Stripe…";
  switch (stage) {
    case "ready":
      return "Manage on Stripe";
    case "in_progress":
      return "Continue setup";
    case "not_started":
      return "Set up payouts";
  }
}

/** A human label for one payout row's status (as the API sends it, e.g. "paid", "awaiting"). */
export function payoutRowStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Paid out";
    case "awaiting":
      return "Awaiting payout";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
