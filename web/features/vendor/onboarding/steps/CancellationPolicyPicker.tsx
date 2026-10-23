"use client";

import { Banner } from "@/components/ui/Banner";
import { Info } from "lucide-react";
import {
  CANCELLATION_POLICY_KEYS,
  CANCELLATION_POLICY_LABELS,
  CANCELLATION_POLICY_ONBOARDING_TIERS,
  CANCELLATION_POLICY_TAGLINES,
  type CancellationPolicyKey,
} from "@/features/bookings/cancellationPolicyCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { Badge } from "@/components/ui/Badge";

type CancellationPolicyPickerProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

/**
 * Step 5 (design V04b): the vendor's choice of client-cancellation preset. Each preset is an
 * `ez-option` card with its refund tiers, so the vendor sees what a client gets back at each
 * point before the event. Until one is chosen, clients are shown Flexible.
 */
export function CancellationPolicyPicker({
  data,
  update,
}: CancellationPolicyPickerProps) {
  return (
    <div className="ez-stack">
      <div className="ez-between">
        <h3 className="ez-h3">Choose one</h3>
        <Badge>Shown on your profile</Badge>
      </div>
      <div
        className="ez-hrow flex-nowrap items-stretch gap-4"
      >
        {CANCELLATION_POLICY_KEYS.map((policyKey: CancellationPolicyKey) => {
          const active = data.cancellationPolicy === policyKey;
          return (
            <label
              key={policyKey}
              className={`ez-option min-w-0 flex-[1_1_220px]${active ? " ez-option--active" : ""}`}
            >
              <input
                type="radio"
                name="cancel"
                aria-label={CANCELLATION_POLICY_LABELS[policyKey]}
                checked={active}
                onChange={() => update({ cancellationPolicy: policyKey })}
              />
              <span className="ez-stack ez-stack--sm flex-1 min-w-0">
                <span className="ez-strong">
                  {CANCELLATION_POLICY_LABELS[policyKey]}
                </span>
                <span className="ez-small">{CANCELLATION_POLICY_TAGLINES[policyKey]}</span>
                <div className="ez-table-wrap mt-2">
                  <table className="ez-table min-w-0 w-full">
                    <tbody>
                      {CANCELLATION_POLICY_ONBOARDING_TIERS[policyKey].map((tier) => (
                        <tr key={tier.window}>
                          <td className="ez-td-strong">{tier.window}</td>
                          <td className="ez-td-num">{tier.refund}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </span>
            </label>
          );
        })}
      </div>
      <Banner
        tone="info"
        icon={<Info size={20} strokeWidth={1.75} aria-hidden />}
        title="Two rules apply to every policy">
        <p className="ez-small text-inherit">
          The Eventtz service fee is always refunded. A client who cancels
          within 24 hours of paying, with the event at least 7 days away, gets
          a full refund.
        </p>
      </Banner>
    </div>
  );
}
