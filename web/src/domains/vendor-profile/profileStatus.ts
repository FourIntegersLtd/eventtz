import type { VendorProfileState } from "@/domains/vendor-profile/api";

/**
 * Human status copy for the profile page's banner.
 *
 * Mirrors `vendor-shell/vendorAccess.ts`'s `vendorIsLiveApproved` check, but
 * a `domain` may not import another domain (eslint boundaries), so the same
 * small rule is restated here rather than shared.
 */
export function vendorIsLiveApproved(profile: Pick<VendorProfileState, "onboarding_status" | "approval_status">): boolean {
  return profile.onboarding_status === "submitted" && profile.approval_status === "approved";
}

export type ProfileStatusBanner = {
  tone: "info" | "warning" | "success" | "none";
  message: string;
};

/** What to tell the vendor about where their profile stands right now. */
export function profileStatusBanner(
  profile: Pick<VendorProfileState, "onboarding_status" | "approval_status" | "listing_visible" | "payouts_verified">,
): ProfileStatusBanner {
  if (profile.approval_status === "banned") {
    return { tone: "warning", message: "An admin has restricted this profile. You can't edit it until that changes." };
  }
  if (profile.onboarding_status !== "submitted") {
    return { tone: "info", message: "Finish your profile and submit it for review to start receiving enquiries." };
  }
  if (profile.approval_status === "pending") {
    return { tone: "info", message: "Thanks — we're reviewing your profile. You can edit again after our review." };
  }
  if (profile.approval_status === "approved" && !profile.listing_visible) {
    return { tone: "warning", message: "Your profile is approved but not yet visible — set up payouts to go live." };
  }
  if (profile.approval_status === "approved" && profile.listing_visible) {
    return { tone: "success", message: "Your profile is live. Clients can find and book you." };
  }
  return { tone: "none", message: "" };
}
