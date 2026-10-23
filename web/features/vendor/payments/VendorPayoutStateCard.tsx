"use client";

import { ArrowUpRight, Check, Circle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Tone } from "@/lib/tone";
import type { VendorPaymentsStatus } from "@/lib/vendorPaymentsApi";
import { isVendorPayoutsReady } from "@/features/vendor/payments/useVendorPayoutsReady";

type PayoutCardVariant = "not_started" | "in_progress" | "ready";

const STEP_LABELS = [
  "Link your payout account",
  "Verify your details",
  "Receive booking payouts",
] as const;

type VendorPayoutStateCardProps = {
  variant: PayoutCardVariant;
  connecting?: boolean;
  onConnect?: () => void;
};

function stepIcon(done: boolean) {
  if (done) {
    return <Check size={18} strokeWidth={1.75} aria-hidden />;
  }
  return <Circle size={18} strokeWidth={1.75} aria-hidden />;
}

/** One payout-account state card (design V12). */
export function VendorPayoutStateCard({ variant, connecting, onConnect }: VendorPayoutStateCardProps) {
  const head =
    variant === "not_started"
      ? { eyebrow: "Not started", badge: "Not connected", badgeTone: "neutral" as Tone }
      : variant === "in_progress"
        ? { eyebrow: "In review", badge: "Verification pending", badgeTone: "warning" as Tone }
        : { eyebrow: "Ready", badge: "Payouts on", badgeTone: "success" as Tone };

  const title =
    variant === "not_started"
      ? "Connect your payout account"
      : variant === "in_progress"
        ? "Almost there: finish verification"
        : "You're ready to get paid";

  const body =
    variant === "not_started"
      ? "Link a UK bank account through Stripe so clients can pay you securely on Eventtz."
      : variant === "in_progress"
        ? "Stripe is reviewing your details. Pick up where you left off to go live."
        : "Booking payouts will land in your linked account after each completed job.";

  const stepsDone =
    variant === "not_started" ? [false, false, false] : variant === "in_progress" ? [true, false, false] : [true, true, true];

  const primaryLabel =
    variant === "ready"
      ? "Manage on Stripe"
      : variant === "in_progress"
        ? connecting
          ? "Opening Stripe…"
          : "Continue setup"
        : connecting
          ? "Opening Stripe…"
          : "Connect with Stripe";

  const btnClass = variant === "ready" ? "ez-btn ez-btn--secondary" : "ez-btn ez-btn--primary";
  const PrimaryIcon = variant === "not_started" ? ExternalLink : variant === "in_progress" ? ArrowUpRight : ExternalLink;

  return (
    <div className="ez-card">
      <div className="ez-card__head">
        <span className="ez-eyebrow">{head.eyebrow}</span>
        <Badge tone={head.badgeTone}>{head.badge}</Badge>
      </div>
      <div className="ez-card__body">
        <div className="ez-stack">
          <h3 className="ez-h3">{title}</h3>
          <p className="ez-small">{body}</p>
          <div className="ez-stack ez-stack--sm">
            {STEP_LABELS.map((label, index) => (
              <div className="ez-hrow" key={label}>
                {stepIcon(stepsDone[index] ?? false)}
                <span className="ez-small">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ez-card__foot">
        <button className={btnClass} type="button" disabled={connecting} onClick={onConnect}>
          <PrimaryIcon size={18} strokeWidth={1.75} aria-hidden />
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

export function resolveLivePayoutCardVariant(status: VendorPaymentsStatus | null): PayoutCardVariant {
  if (!status?.stripe_account_id) return "not_started";
  if (isVendorPayoutsReady(status)) return "ready";
  return "in_progress";
}
