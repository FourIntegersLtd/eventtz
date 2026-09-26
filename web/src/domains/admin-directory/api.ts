import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminVendorRow = components["schemas"]["AdminVendorRow"];
export type AdminClientRow = components["schemas"]["AdminClientRow"];
export type AdminVendorInsights = components["schemas"]["AdminVendorInsightsResponse"];

/** Vendors, most recently updated first, searched and filtered. Any admin may read this. */
export async function fetchAdminVendors(
  query: { offset?: number; limit?: number; q?: string; approval_status?: string } = {},
): Promise<{ vendors: AdminVendorRow[]; total: number }> {
  const response = await platformRequest<components["schemas"]["AdminVendorsListResponse"]>(
    "/api/v1/admin/vendors",
    { query },
  );
  return { vendors: response.vendors ?? [], total: response.total };
}

/** Approves, bans or re-queues a vendor. Any admin may moderate vendors. */
export async function setAdminVendorApproval(
  userId: string,
  approvalStatus: "pending" | "approved" | "banned",
): Promise<void> {
  await platformRequest<components["schemas"]["AdminVendorApprovalResponse"]>(
    `/api/v1/admin/vendors/${encodeURIComponent(userId)}/approval`,
    { method: "PATCH", body: { approval_status: approvalStatus } },
  );
}

/** One vendor's booking history and review standing. Never 404s. */
export async function fetchAdminVendorInsights(userId: string): Promise<AdminVendorInsights> {
  return platformRequest<AdminVendorInsights>(`/api/v1/admin/vendors/${encodeURIComponent(userId)}/insights`);
}

/** A page of the client directory, optionally filtered by email search or suspension. */
export async function fetchAdminClients(
  query: { offset?: number; limit?: number; q?: string } = {},
): Promise<{ clients: AdminClientRow[]; total: number }> {
  const response = await platformRequest<components["schemas"]["AdminClientsListResponse"]>(
    "/api/v1/admin/clients",
    { query },
  );
  return { clients: response.clients, total: response.total };
}

/** Suspends or restores one client account. Any admin may do this. */
export async function setAdminClientSuspended(userId: string, suspended: boolean): Promise<void> {
  await platformRequest(`/api/v1/admin/clients/${encodeURIComponent(userId)}/suspended`, {
    method: "PATCH",
    body: { suspended },
  });
}
