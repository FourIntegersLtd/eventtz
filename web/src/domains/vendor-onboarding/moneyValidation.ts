/** Strict GBP amount validation for vendor onboarding package/rate prices (Tier A).
 *  Booking/refund forms use `moneyGbpSchema` in common.ts (Tier C — formatted amounts OK). */

import { z } from "zod";
import type { RefinementCtx } from "zod";
import {
  MAX_MONEY_GBP as ONBOARDING_MAX_MONEY_GBP,
  MIN_MONEY_GBP as ONBOARDING_MIN_MONEY_GBP,
} from "@/domains/vendor-onboarding/constants";

/** Re-export for callers that import limits from validation/money. */
export const MIN_MONEY_GBP = ONBOARDING_MIN_MONEY_GBP;
export const MAX_MONEY_GBP = ONBOARDING_MAX_MONEY_GBP;

const MULTIPLE_AMOUNT_SEPARATOR_RE = /[,;/|]/;

const AMBIGUOUS_PRICE_RE =
  /\b(starts?\s+from|from\s+£|from\s+\d|price\s+on\s+request|\bpoa\b|\btbc\b|£?\s*\d+(?:\.\d+)?\s*[-–—]\s*£?\s*\d+|\d+\s+(?:and|or)\s+\d+)/i;

const SINGLE_GBP_AMOUNT_RE = /^(?:£|gbp\s*)?\s*(\d+(?:\.\d{1,2})?)\s*$/i;

export type ValidateSingleMoneyOptions = {
  required?: boolean;
  min?: number;
  max?: number;
};

/** Returns an error message, or null when the value is a single valid GBP amount. */
export function validateSingleMoneyAmount(
  raw: string,
  label: string,
  opts: ValidateSingleMoneyOptions = {},
): string | null {
  const trimmed = raw.trim();
  const required = opts.required ?? false;
  const min = opts.min ?? MIN_MONEY_GBP;
  const max = opts.max ?? MAX_MONEY_GBP;

  if (!trimmed) {
    return required ? `${label} is required` : null;
  }
  if (MULTIPLE_AMOUNT_SEPARATOR_RE.test(trimmed)) {
    return `${label} must be one amount only — add a separate package for each price.`;
  }
  if (AMBIGUOUS_PRICE_RE.test(trimmed)) {
    return `${label} must be one fixed amount, not a range or “starts from” price.`;
  }
  const match = trimmed.match(SINGLE_GBP_AMOUNT_RE);
  if (!match) {
    return `${label} must be a single number (e.g. 150 or 150.00).`;
  }
  const n = Number.parseFloat(match[1]!);
  if (!Number.isFinite(n)) {
    return `${label} must be a valid amount`;
  }
  if (n < min || n > max) {
    if (n < min) return `${label} must be at least £${min.toFixed(2)}`;
    return `${label} is out of allowed range`;
  }
  return null;
}

/** Parse a strictly validated single GBP amount, or null if invalid / ambiguous. */
export function parseSingleMoneyNumber(raw: string): number | null {
  const err = validateSingleMoneyAmount(raw, "Amount");
  if (err) return null;
  const match = raw.trim().match(SINGLE_GBP_AMOUNT_RE);
  if (!match) return null;
  return Number.parseFloat(match[1]!);
}

/** Add a single-GBP validation issue to a Zod refinement context. */
export function addSingleGbpAmountIssue(
  ctx: RefinementCtx,
  raw: string,
  label: string,
  opts: ValidateSingleMoneyOptions = {},
): void {
  const err = validateSingleMoneyAmount(raw, label, opts);
  if (err) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
  }
}

/** Zod schema for one fixed GBP amount (optional when empty unless `required`). */
export function singleGbpAmountFieldSchema(
  label: string,
  opts: ValidateSingleMoneyOptions = {},
) {
  return z.string().superRefine((raw, ctx) => {
    addSingleGbpAmountIssue(ctx, raw, label, opts);
  });
}

/** First Zod error for a single GBP field, or null when valid. */
export function singleGbpAmountFieldError(
  raw: string,
  label: string,
  opts: ValidateSingleMoneyOptions = {},
): string | null {
  const result = singleGbpAmountFieldSchema(label, opts).safeParse(raw);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? null;
}

export const packagePriceFieldSchema = singleGbpAmountFieldSchema("Package price", {
  required: true,
});

export const optionalHourlyRateFieldSchema = singleGbpAmountFieldSchema("Hourly rate", {
  required: false,
});

export const optionalDailyRateFieldSchema = singleGbpAmountFieldSchema("Daily rate", {
  required: false,
});

export const optionalBulkThresholdFieldSchema = singleGbpAmountFieldSchema("Bulk threshold", {
  required: false,
});
