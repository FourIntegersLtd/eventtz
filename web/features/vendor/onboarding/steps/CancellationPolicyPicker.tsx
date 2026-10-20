"use client";

import { Info } from "lucide-react";
import {
  CANCELLATION_POLICY_KEYS,
  CANCELLATION_POLICY_LABELS,
  CANCELLATION_POLICY_ONBOARDING_TIERS,
  CANCELLATION_POLICY_TAGLINES,
  type CancellationPolicyKey,
} from "@/features/bookings/cancellationPolicyCopy";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";

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
        <span className="ez-badge">Shown on your profile</span>
      </div>
      <div
        className="ez-hrow"
        style={{
          alignItems: "stretch",
          flexWrap: "nowrap",
          gap: 16,
        }}
      >
        {CANCELLATION_POLICY_KEYS.map((policyKey: CancellationPolicyKey) => {
          const active = data.cancellationPolicy === policyKey;
          return (
            <label
              key={policyKey}
              className={`ez-option${active ? " ez-option--active" : ""}`}
              style={{ flex: "1 1 220px", minWidth: 0 }}
            >
              <input
                type="radio"
                name="cancel"
                aria-label={CANCELLATION_POLICY_LABELS[policyKey]}
                checked={active}
                onChange={() => update({ cancellationPolicy: policyKey })}
              />
              <span className="ez-stack ez-stack--sm" style={{ flex: 1, minWidth: 0 }}>
                <span className="ez-strong">
                  {CANCELLATION_POLICY_LABELS[policyKey]}
                </span>
                <span className="ez-small">{CANCELLATION_POLICY_TAGLINES[policyKey]}</span>
                <div className="ez-table-wrap" style={{ marginTop: 8 }}>
                  <table className="ez-table" style={{ minWidth: 0, width: "100%" }}>
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
      <div className="ez-banner ez-banner--info">
        <Info size={20} strokeWidth={1.75} aria-hidden />
        <div className="ez-banner__body">
          <div className="ez-banner__title">
            Two rules apply to every policy
          </div>
          <p className="ez-small" style={{ color: "inherit" }}>
            The Eventtz service fee is always refunded. A client who cancels
            within 24 hours of paying, with the event at least 7 days away, gets
            a full refund.
          </p>
        </div>
      </div>
    </div>
  );
}
