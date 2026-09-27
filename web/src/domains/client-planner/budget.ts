/**
 * Budget bar scale and totals, in integer pence.
 *
 * The plan endpoint already sends `total_estimated_gbp` and
 * `remaining_budget_gbp` (pounds, rounded to 2 decimal places on the server).
 * The screen prints those with `formatGbp`. Anything this module adds up —
 * the bar's scale, a line total — converts each pound amount to pence first
 * so a binary float never becomes the total.
 */
import { formatGbp } from "@/domains/client-planner/format";

/** Whole pence from a GBP-pound amount. Half rounds away from zero via `Math.round`. */
export function gbpToPence(amountGbp: number): number {
  return Math.round(amountGbp * 100);
}

/**
 * The bar track's maximum, in pence.
 *
 * The baseline floors the scale at £1 (`Math.max(1, …amounts)`) so a plan
 * with only zero-cost lines still has a track to draw against.
 */
export function budgetBarMaxPence(lineAmountsGbp: readonly number[], userBudgetGbp: number | null): number {
  const linePence = lineAmountsGbp.map((amountGbp) => gbpToPence(amountGbp));
  const userBudgetPence = userBudgetGbp == null ? 0 : gbpToPence(userBudgetGbp);
  return Math.max(gbpToPence(1), ...linePence, userBudgetPence);
}

/** Bar width for one line, capped at 100, using the pence scale from `budgetBarMaxPence`. */
export function budgetBarWidthPercent(amountGbp: number, maxPence: number): number {
  if (maxPence <= 0) return 0;
  return Math.min(100, (gbpToPence(amountGbp) / maxPence) * 100);
}

/** Sum of line amounts as whole pence. Each line is rounded before adding. */
export function budgetLinesTotalPence(lineAmountsGbp: readonly number[]): number {
  return lineAmountsGbp.reduce((totalPence, amountGbp) => totalPence + gbpToPence(amountGbp), 0);
}

/**
 * Pence left of a stated budget after `totalPence`. Negative means over budget.
 * `null` when the client did not state a budget, matching the API.
 */
export function remainingBudgetPence(userBudgetGbp: number | null, totalPence: number): number | null {
  if (userBudgetGbp == null) return null;
  return gbpToPence(userBudgetGbp) - totalPence;
}

/**
 * The "£200 remaining" / "£50 over" caption beside the total.
 *
 * Uses the server's `remaining_budget_gbp` (not a client re-sum) and the
 * baseline's whole-pound formatter. A missing remaining with a stated budget
 * prints as over £0, which is what the baseline JSX does.
 */
export function remainingBudgetCaption(remainingGbp: number | null, userBudgetGbp: number | null): string | null {
  if (userBudgetGbp == null) return null;
  if (remainingGbp != null && remainingGbp >= 0) {
    return `${formatGbp(remainingGbp)} remaining`;
  }
  return `${formatGbp(Math.abs(remainingGbp ?? 0))} over`;
}
