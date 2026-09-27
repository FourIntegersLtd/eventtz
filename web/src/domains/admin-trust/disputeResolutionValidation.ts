/** Validates admin dispute financial resolution before calling the api. */

export type DisputeResolutionAction = "release_to_vendor" | "refund_client" | "partial_refund" | "";

export function validateDisputeFinancialResolution(
  action: DisputeResolutionAction,
  refundAmountGbp: string,
): string | null {
  if (!action) return "Choose a resolution action.";
  if (action !== "partial_refund") return null;
  const amount = Number(refundAmountGbp);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a refund amount greater than zero.";
  return null;
}
