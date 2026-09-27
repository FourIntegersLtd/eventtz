/**
 * Display formatters for the planner. Amounts arrive as GBP pounds
 * (`amount_gbp`); arithmetic uses whole pence in `budget.ts`, and only these
 * functions turn a number into text.
 *
 * `formatGbp` matches the baseline planner: whole pounds, en-GB, and "-" when
 * the amount is missing. That is a different shape from the bookings domain's
 * two-decimal formatter, which this module does not import.
 */

/** Formats a GBP-pound amount as whole pounds (`£1,234`), or "-" when absent. */
export function formatGbp(amountGbp: number | null | undefined): string {
  if (amountGbp == null || Number.isNaN(amountGbp)) return "-";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amountGbp);
}
