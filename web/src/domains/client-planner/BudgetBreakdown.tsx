/**
 * Budget breakdown: one bar per line, the estimated total, and what is left
 * of the client's budget. Widths are computed in integer pence; the figures
 * on screen are the server's pound amounts, formatted like the baseline.
 */
import type { components } from "@/foundation/platform-client";
import { budgetBarMaxPence, budgetBarWidthPercent, remainingBudgetCaption } from "@/domains/client-planner/budget";
import { formatGbp } from "@/domains/client-planner/format";
import { PLANNER_COPY } from "@/domains/client-planner/plannerCopy";

type Budget = components["schemas"]["BudgetBreakdown"];

/** The sticky budget card on a plan. */
export function BudgetBreakdown({ budget }: { budget: Budget }) {
  const maxPence = budgetBarMaxPence(
    budget.lines.map((line) => line.amount_gbp),
    budget.user_budget_gbp,
  );
  const caption = remainingBudgetCaption(budget.remaining_budget_gbp, budget.user_budget_gbp);

  return (
    <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
      <h3 className="font-heading text-lg font-semibold text-neutral-900">{PLANNER_COPY.budgetHeading}</h3>
      {budget.over_budget ? (
        <p className="mt-2 text-xs font-medium text-amber-800">{PLANNER_COPY.overBudget}</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {budget.lines.map((line) => (
          <li key={line.need_id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-neutral-700">{line.label}</span>
              <span className="font-medium tabular-nums text-neutral-900">{formatGbp(line.amount_gbp)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${budgetBarWidthPercent(line.amount_gbp, maxPence)}%` }}
              />
            </div>
            {line.assumption ? (
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{line.assumption}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
        <span className="font-semibold text-neutral-900">Total {formatGbp(budget.total_estimated_gbp)}</span>
        {caption ? <span className="text-neutral-600">{caption}</span> : null}
      </div>
      {budget.assumptions.length ? (
        <div className="mt-4 rounded-lg bg-neutral-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {PLANNER_COPY.budgetHowEstimated}
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
