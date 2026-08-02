import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import {
  mergePayloadIntoVendorData,
  normalizeVendorPayload,
} from "@/features/vendor/onboarding/serializeVendorPayload";
import {
  initialVendorOnboardingData,
  type VendorOnboardingData,
} from "@/features/vendor/onboarding/types";

export function adminVendorToOnboardingData(
  vendor: AdminVendorRow,
): VendorOnboardingData {
  const merged = mergePayloadIntoVendorData(
    normalizeVendorPayload(vendor.payload),
    vendor.email ?? "",
  );

  return {
    ...initialVendorOnboardingData,
    ...merged,
    email: merged.email?.trim() || vendor.email || "",
    password: "",
  };
}
