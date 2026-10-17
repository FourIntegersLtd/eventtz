"use client";

import { AlertCircle, Clock, Receipt } from "lucide-react";
import {
  CANCELLATION_POLICY_KEYS,
  CANCELLATION_POLICY_LABELS,
  CANCELLATION_POLICY_NOT_CHOSEN,
  CANCELLATION_POLICY_SUMMARIES,
  cancellationPolicyTiers,
  type CancellationPolicyKey,
  type CancellationPolicyTier,
} from "@/features/bookings/cancellationPolicyCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import { OnboardingOptionPill } from "../ui/OnboardingOptionPill";
import { OnboardingSubQuestion } from "../ui/OnboardingQuestionLayout";

type CancellationPolicyPickerProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  /** Animation offset when shown inside a longer step (Pricing in the wizard). */
  indexOffset?: number;
};

/**
 * The protections every preset gives the client, worded for the vendor. The client-facing
 * wording is `CANCELLATION_POLICY_GUARANTEES`; keep the two saying the same thing.
 */
const VENDOR_GUARANTEES = [
  {
    icon: Clock,
    title: "24-hour change of mind",
    detail: "Full refund if the client cancels within 24 hours of paying and the event is at least 7 days away.",
  },
  {
    icon: Receipt,
    title: "Service fee always refunded",
    detail: "The Eventtz service fee goes back to the client whatever the timing.",
  },
] as const;

/** Percentage of the vendor's price a tier refunds: "Full refund" → 100, "50% refund" → 50, "No refund" → 0. */
function refundPercent(tier: CancellationPolicyTier): number {
  if (tier.refund === "Full refund") return 100;
  if (tier.refund === "No refund") return 0;
  return Number.parseInt(tier.refund, 10);
}

/** Bar colour by how much goes back to the client: all (green), some (amber), none (grey). */
function refundBarClass(percent: number): string {
  if (percent === 100) return "bg-emerald-500";
  if (percent === 0) return "bg-neutral-300";
  return "bg-amber-400";
}

/** One tier: when the client cancels, a bar of what they get back, and what the vendor keeps. */
function TierRow({ tier }: { tier: CancellationPolicyTier }) {
  const percent = refundPercent(tier);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-neutral-900">{tier.window}</p>
      <p className="text-right text-sm font-semibold text-neutral-900">
        You keep {100 - percent}%
      </p>
      <div className="col-span-2 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"
          role="img"
          aria-label={`Client gets ${percent}% back`}
        >
          <div className={`h-full rounded-full ${refundBarClass(percent)}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="w-28 shrink-0 text-right text-xs text-neutral-500">Client: {tier.refund.toLowerCase()}</span>
      </div>
    </li>
  );
}

/**
 * The vendor's choice of client-cancellation preset, with the chosen preset's refund tiers
 * drawn out so the vendor sees what they keep at each point before the event.
 */
export function CancellationPolicyPicker({ data, update, indexOffset = 0 }: CancellationPolicyPickerProps) {
  const chosen = (CANCELLATION_POLICY_KEYS as readonly string[]).includes(data.cancellationPolicy)
    ? (data.cancellationPolicy as CancellationPolicyKey)
    : null;

  return (
    <OnboardingSubQuestion
      headline="Cancellation policy"
      subtext="If a client cancels after paying, this decides how much of your price they get back. The Eventtz service fee is always refunded."
      indexOffset={indexOffset}
    >
      <div className="space-y-2">
        {CANCELLATION_POLICY_KEYS.map((policyKey) => (
          <OnboardingOptionPill
            key={policyKey}
            active={data.cancellationPolicy === policyKey}
            onClick={() => update({ cancellationPolicy: policyKey })}
            description={CANCELLATION_POLICY_SUMMARIES[policyKey]}
          >
            {CANCELLATION_POLICY_LABELS[policyKey]}
          </OnboardingOptionPill>
        ))}
      </div>

      {chosen ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 bg-primary/5 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-neutral-900">
              How {CANCELLATION_POLICY_LABELS[chosen]} works
            </p>
            <p className="text-xs text-neutral-500">What you keep is paid to you straight away</p>
          </div>
          <ul className="divide-y divide-neutral-100 px-4 py-4 sm:px-5">
            {cancellationPolicyTiers(chosen).map((tier) => (
              <TierRow key={tier.window} tier={tier} />
            ))}
          </ul>
          <div className="border-t border-neutral-100 bg-neutral-50/70 px-4 py-3 sm:px-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Every policy also</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {VENDOR_GUARANTEES.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-start gap-2 text-xs text-neutral-600">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                  <span>
                    <span className="block font-semibold text-neutral-800">{title}</span>
                    {detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {CANCELLATION_POLICY_NOT_CHOSEN}
        </p>
      )}
    </OnboardingSubQuestion>
  );
}
