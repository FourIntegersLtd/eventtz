import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import { isHttpStatus } from "@/lib/api-errors";
export { getApiErrorDetail } from "@/lib/api-errors";

/**
 * `profile_form_data` is a free-form dict in the API schema, so it stays `Record<string, unknown>`.
 * `onboarding_status` and `approval_status` are plain strings in the API and are narrowed by the
 * screens that read them.
 */
export type VendorProfileResponse = components["schemas"]["VendorProfileState"];

type VendorProfilePutBody = components["schemas"]["VendorProfilePutBody"];

export function isVendorProfileForbiddenError(error: unknown): boolean {
  return isHttpStatus(error, 403);
}

export async function fetchVendorProfile(): Promise<VendorProfileResponse> {
  const { data } = await api.get<VendorProfileResponse>("/api/v1/vendor/profile");
  return data;
}

/**
 * The API accepts the status as `status` or (the field's own name) `onboarding_status`
 * (`populate_by_name`), and the screens send the latter.
 */
export async function saveVendorProfile(
  body: Pick<VendorProfilePutBody, "current_step"> & {
    profile_form_data: Record<string, unknown>;
    onboarding_status?: string;
  },
): Promise<VendorProfileResponse> {
  const { data } = await api.put<VendorProfileResponse>("/api/v1/vendor/profile", body);
  return data;
}

export async function checkBusinessNameAvailable(
  businessName: string,
): Promise<{ available: boolean }> {
  const { data } = await api.get<components["schemas"]["VendorBusinessNameAvailabilityResponse"]>(
    "/api/v1/vendor/profile/business-name-available",
    { params: { business_name: businessName.trim() } },
  );
  return { available: data.available };
}
