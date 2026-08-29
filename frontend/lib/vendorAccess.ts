/** Shared vendor-portal access predicates (onboarding vs live approved). */

export function vendorIsLiveApproved(profile: {
  onboarding_status?: string | null;
  approval_status?: string | null;
}): boolean {
  return profile.onboarding_status === "submitted" && profile.approval_status === "approved";
}

/** Keep in sync with pending nav in `portalNavItems` (Profile, Help, Settings). */
const VENDOR_PRE_APPROVAL_PREFIXES = ["/vendor/profile", "/vendor/help", "/vendor/settings"] as const;

/** Routes pending (not yet live-approved) vendors may use without RequireVendorApproved. */
export function isVendorPreApprovalRoute(pathname: string): boolean {
  return VENDOR_PRE_APPROVAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
