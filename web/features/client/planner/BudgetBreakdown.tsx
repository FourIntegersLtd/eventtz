"use client";

import { Send } from "lucide-react";
import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { formatGbp } from "@/lib/money";
import { PLANNER_COPY } from "./plannerCopy";

type BudgetBreakdownProps = {
  budget: CelebrationPlanResponse["budget"];
  selectedCount: number;
  enquiryBusy: boolean;
  enquiryDisabled: boolean;
  onSendEnquiry: () => void;
};

/** C07 sticky budget card (`ez-lines`, `ez-progress`). */
export function BudgetBreakdown({
  budget,
  selectedCount,
  enquiryBusy,
  enquiryDisabled,
  onSendEnquiry,
}: BudgetBreakdownProps) {
  const userBudget = budget.user_budget_gbp ?? budget.total_estimated_gbp ?? 0;
  const total = budget.total_estimated_gbp ?? 0;
  const progress =
    userBudget > 0 ? Math.min(100, Math.round((total / userBudget) * 100)) : total > 0 ? 100 : 0;

  const remainingCaption = () => {
    if (budget.user_budget_gbp == null) return null;
    if (budget.over_budget) {
      return `${formatGbp(Math.abs(budget.remaining_budget_gbp ?? 0), { decimals: 0 })} over your ${formatGbp(budget.user_budget_gbp, { decimals: 0 })} budget.`;
    }
    if (budget.remaining_budget_gbp != null && budget.remaining_budget_gbp >= 0) {
      return `On budget. ${formatGbp(budget.remaining_budget_gbp, { decimals: 0 })} left of ${formatGbp(budget.user_budget_gbp, { decimals: 0 })}.`;
    }
    return null;
  };

  return (
    <div className="ez-card ez-card--raised" style={{ position: "sticky", top: 16 }}>
      <div className="ez-card__head">
        <span className="ez-h3">{PLANNER_COPY.estimatedBudget}</span>
      </div>
      <div className="ez-card__body ez-stack">
        {budget.over_budget ? (
          <div className="ez-banner ez-banner--warning" role="status">{PLANNER_COPY.overBudget}</div>
        ) : null}
        <div className="ez-lines">
          {budget.lines.map((line) => (
            <div key={line.need_id} className="ez-lines__row">
              <span>{line.label}</span>
              <span>{formatGbp(line.amount_gbp, { decimals: 0 })}</span>
            </div>
          ))}
          <div className="ez-lines__total">
            <span>Estimated total</span>
            <span>{formatGbp(budget.total_estimated_gbp, { decimals: 0 })}</span>
          </div>
        </div>
        <div className="ez-progress" aria-hidden>
          <div className="ez-progress__bar" style={{ width: `${progress}%` }} />
        </div>
        {remainingCaption() ? <span className="ez-caption">{remainingCaption()}</span> : null}
      </div>
      <div className="ez-card__foot" style={{ flexDirection: "column" }}>
        <button
          type="button"
          className="ez-btn ez-btn--primary ez-btn--block"
          disabled={enquiryDisabled || enquiryBusy || selectedCount === 0}
          onClick={onSendEnquiry}
        >
          <Send width={18} height={18} strokeWidth={1.75} aria-hidden />
          {PLANNER_COPY.sendEnquiryLabel} ({selectedCount})
        </button>
        <span className="ez-caption">{PLANNER_COPY.sendEnquiryHint}</span>
      </div>
    </div>
  );
}
