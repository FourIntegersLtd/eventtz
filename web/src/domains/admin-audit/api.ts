import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminAuditLogItem = components["schemas"]["AdminAuditLogItem"];

/** The category filter offered on `/admin/audit`, matching the baseline's `AUDIT_CATEGORIES`. */
export const AUDIT_CATEGORIES = [
  { value: "all", label: "All activity" },
  { value: "bookings", label: "Bookings" },
  { value: "clients", label: "Clients" },
  { value: "vendors", label: "Vendors" },
  { value: "disputes", label: "Disputes" },
  { value: "reviews", label: "Reviews" },
  { value: "chat", label: "Chat" },
  { value: "financials", label: "Financials" },
  { value: "team", label: "Team" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["value"];

/** One page of the audit trail, optionally filtered by category. */
export async function fetchAdminAuditLog(
  offset: number,
  limit: number,
  category: AuditCategory,
): Promise<{ entries: AdminAuditLogItem[]; total: number }> {
  const response = await platformRequest<components["schemas"]["AdminAuditLogResponse"]>(
    "/api/v1/admin/audit-log",
    { query: { offset, limit, category } },
  );
  return { entries: response.entries, total: response.total };
}

/** One audit entry, for the detail screen. */
export async function fetchAdminAuditLogEntry(entryId: string): Promise<AdminAuditLogItem> {
  const response = await platformRequest<components["schemas"]["AdminAuditLogDetailResponse"]>(
    `/api/v1/admin/audit-log/${encodeURIComponent(entryId)}`,
  );
  return response.entry;
}
