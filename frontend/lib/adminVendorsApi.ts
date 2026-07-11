import api from "@/lib/axios";
import type { ApiListResponse } from "@/lib/api-types";
import type { VendorApprovalStatus, VendorProfileStatus } from "@/lib/domain-types";

export type AdminVendorRow = {
  id: string | null;
  user_id: string;
  email: string | null;
  status: VendorProfileStatus | string;
  approval_status: VendorApprovalStatus | string;
  current_step: number | null;
  payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export async function fetchAdminVendors(): Promise<AdminVendorRow[]> {
  const { data } = await api.get<ApiListResponse<AdminVendorRow>>("/api/v1/admin/vendors");
  return data.vendors ?? [];
}

export async function patchVendorApproval(
  userId: string,
  approval_status: VendorApprovalStatus,
): Promise<void> {
  await api.patch(`/api/v1/admin/vendors/${userId}/approval`, {
    approval_status,
  });
}

export type AdminVendorInsights = {
  success: boolean;
  user_id: string;
  review_average: number | null;
  review_count: number;
  bookings_total: number;
  bookings_by_status: Record<string, number>;
  open_disputes_on_bookings: number;
  explore_path: string;
};

export async function fetchAdminVendorInsights(userId: string): Promise<AdminVendorInsights> {
  const { data } = await api.get<AdminVendorInsights>(`/api/v1/admin/vendors/${userId}/insights`);
  return data;
}
