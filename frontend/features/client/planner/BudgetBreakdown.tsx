"use client";

import type { CelebrationPlanResponse } from "@/lib/clientPlannerApi";
import { formatGbp } from "./plannerModel";
import { PLANNER_COPY } from "./plannerCopy";

type BudgetBreakdownProps = {
  budget: CelebrationPlanResponse["budget"];
};

export function BudgetBreakdown({ budget }: BudgetBreakdownProps) {
  const maxLine = Math.max(
    1,
    ...budget.lines.map((l) => l.amount_gbp),
    budget.user_budget_gbp ?? 0,
  );

  return (
    <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-neutral-900">Budget breakdown</h3>
      {budget.over_budget ? (
        <p className="mt-2 text-xs font-medium text-amber-800">{PLANNER_COPY.overBudget}</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {budget.lines.map((line) => (
          <li key={line.need_id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-neutral-700">{line.label}</span>
              <span className="font-medium tabular-nums text-neutral-900">
                {formatGbp(line.amount_gbp)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${Math.min(100, (line.amount_gbp / maxLine) * 100)}%` }}
              />
            </div>
            {line.assumption ? (
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{line.assumption}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
        <span className="font-semibold text-neutral-900">
          Total {formatGbp(budget.total_estimated_gbp)}
        </span>
        {budget.user_budget_gbp != null ? (
          <span className="text-neutral-600">
            {budget.remaining_budget_gbp != null && budget.remaining_budget_gbp >= 0
              ? `${formatGbp(budget.remaining_budget_gbp)} remaining`
              : `${formatGbp(Math.abs(budget.remaining_budget_gbp ?? 0))} over`}
          </span>
        ) : null}
      </div>
      {budget.assumptions?.length ? (
        <div className="mt-4 rounded-lg bg-neutral-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            How we estimated this
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-snug text-neutral-600">
            {budget.assumptions.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
