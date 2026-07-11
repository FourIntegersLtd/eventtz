import api from "@/lib/axios";
import { isHttpStatus } from "@/lib/api-errors";
import type { VendorApprovalStatus, VendorProfileStatus } from "@/lib/domain-types";
export { getApiErrorDetail } from "@/lib/api-errors";

export type VendorProfileResponse = {
  success: boolean;
  current_step: number;
  status: VendorProfileStatus | string;
  /** pending until an admin approves; approved unlocks profile review after submission. */
  approval_status?: VendorApprovalStatus | string;
  payload: Record<string, unknown>;
  updated_at?: string;
};

export function isVendorProfileForbiddenError(error: unknown): boolean {
  return isHttpStatus(error, 403);
}

export async function fetchVendorProfile(): Promise<VendorProfileResponse> {
  const { data } = await api.get<VendorProfileResponse>("/api/v1/vendor/profile");
  return data;
}

export async function saveVendorProfile(body: {
  current_step: number;
  payload: Record<string, unknown>;
  status?: string;
}): Promise<VendorProfileResponse> {
  const { data } = await api.put<VendorProfileResponse>(
    "/api/v1/vendor/profile",
    body,
  );
  return data;
}
