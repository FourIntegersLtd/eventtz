import { platformRequest, type components } from "@/foundation/platform-client";

/** The vendor's onboarding form and listing state, as `GET /vendor/profile` returns it. */
export type VendorProfileState = components["schemas"]["VendorProfileState"];

/**
 * Fetch the caller's vendor profile.
 *
 * Used by the portal shell to decide whether the vendor is live-approved
 * (see `vendorIsLiveApproved`), and by the profile pages themselves.
 */
export function fetchVendorProfile(): Promise<VendorProfileState> {
  return platformRequest<VendorProfileState>("/api/v1/vendor/profile");
}
