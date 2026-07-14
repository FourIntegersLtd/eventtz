import api from "@/lib/axios";
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

export type AdminVendorsQuery = {
  offset?: number;
  limit?: number;
  q?: string;
  approval_status?: string;
  status?: string;
};

export type AdminVendorsListResult = {
  vendors: AdminVendorRow[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchAdminVendors(
  q: AdminVendorsQuery = {},
): Promise<AdminVendorsListResult> {
  const { data } = await api.get<{
    success: boolean;
    vendors: AdminVendorRow[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/vendors", {
    params: {
      offset: q.offset ?? 0,
      limit: q.limit ?? 50,
      q: q.q?.trim() || undefined,
      approval_status: q.approval_status || undefined,
      status: q.status || undefined,
    },
  });
  return {
    vendors: data.vendors ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    limit: data.limit ?? 50,
  };
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
