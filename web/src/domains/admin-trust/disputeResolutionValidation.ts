/** Validates admin dispute financial resolution before calling the api (baseline: `DisputeResolveModal`). */

export type DisputeResolutionAction = "release_to_vendor" | "refund_client" | "partial_refund" | "";

export type DisputeFinancialResolutionResult = { error: string } | { refundAmountGbp: number | null };

/** Parses a user-typed GBP amount (`frontend/lib/validation/common.ts` `moneyGbpSchema`). */
function parseMoneyGbpInput(raw: string): number | string {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter an amount.";
  const cleaned = trimmed.replace(/£/g, "").replace(/,/g, "").trim();
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return "Enter a valid amount in pounds (£).";
  if (amount < 0) return "Amount can't be negative.";
  if (amount > 1_000_000) return "That amount is too high.";
  return amount;
}

export function validateDisputeFinancialResolution(
  action: DisputeResolutionAction,
  refundAmountRaw: string,
  note: string,
): DisputeFinancialResolutionResult {
  if (!action) return { error: "Choose a resolution action." };

  const trimmedNote = note.trim();
  if (trimmedNote.length > 8000) return { error: "Message is too long." };

  if (action === "partial_refund") {
    const parsedAmount = parseMoneyGbpInput(refundAmountRaw);
    if (typeof parsedAmount === "string") return { error: parsedAmount };
    if (parsedAmount <= 0) return { error: "Enter a refund amount greater than zero." };
    return { refundAmountGbp: parsedAmount };
  }

  return { refundAmountGbp: null };
}
