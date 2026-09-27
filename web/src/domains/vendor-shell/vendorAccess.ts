import type { VendorProfileState } from "@/domains/vendor-shell/api";

/**
 * Whether a vendor is live-approved: listed to clients and free to use the
 * full portal. Ported from the baseline's `frontend/lib/vendorAccess.ts`.
 */
export function vendorIsLiveApproved(profile: Pick<VendorProfileState, "onboarding_status" | "approval_status">): boolean {
  return profile.onboarding_status === "submitted" && profile.approval_status === "approved";
}
