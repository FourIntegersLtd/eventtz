import type { AdminVendorRow } from "@/lib/adminVendorsApi";

export function vendorIsDraft(row: AdminVendorRow): boolean {
  return row.onboarding_status === "draft";
}

export function vendorNeedsPayoutSetup(row: AdminVendorRow): boolean {
  return row.approval_status === "approved" && !row.payouts_verified;
}

/**
 * Suspended vendors are never offered a reminder. Closed accounts are not in the row, so the
 * server (`_nudge`) is the guard for those and counts them as skipped.
 */
export function vendorIsBulkEmailSelectable(row: AdminVendorRow): boolean {
  if (row.approval_status === "banned") return false;
  return vendorIsDraft(row) || vendorNeedsPayoutSetup(row);
}
