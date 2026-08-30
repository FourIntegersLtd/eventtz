import type { AdminVendorRow } from "@/lib/adminVendorsApi";

export function vendorIsDraft(row: AdminVendorRow): boolean {
  return row.onboarding_status === "draft";
}

export function vendorNeedsPayoutSetup(row: AdminVendorRow): boolean {
  return row.approval_status === "approved" && !row.payouts_verified;
}

export function vendorIsBulkEmailSelectable(row: AdminVendorRow): boolean {
  return vendorIsDraft(row) || vendorNeedsPayoutSetup(row);
}
