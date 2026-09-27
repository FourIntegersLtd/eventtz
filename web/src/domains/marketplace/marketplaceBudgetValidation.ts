import { z } from "zod";

const marketplaceBudgetSchema = z
  .object({
    min: z.string().trim().optional().default(""),
    max: z.string().trim().optional().default(""),
  })
  .superRefine((value, context) => {
    const parseAmount = (raw: string, path: string) => {
      if (!raw) return null;
      const amount = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "Enter a valid budget amount.",
        });
        return null;
      }
      return amount;
    };
    const minAmount = parseAmount(value.min ?? "", "min");
    const maxAmount = parseAmount(value.max ?? "", "max");
    if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max"],
        message: "Max budget must be at least the min.",
      });
    }
  });

export type MarketplaceBudgetValidationResult =
  | { ok: true; budgetMin: number | null; budgetMax: number | null }
  | { ok: false; formError: string };

function parseBudgetField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const amount = Number.parseFloat(trimmed.replace(/,/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** Validate min/max budget strings using the baseline marketplace rules. */
export function validateMarketplaceBudget(input: {
  min: string;
  max: string;
}): MarketplaceBudgetValidationResult {
  const parsed = marketplaceBudgetSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      formError: firstIssue?.message ?? "Enter a valid budget amount.",
    };
  }
  return {
    ok: true,
    budgetMin: parseBudgetField(input.min),
    budgetMax: parseBudgetField(input.max),
  };
}
