import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type AdminAuditLogItem = components["schemas"]["AdminAuditLogItem"];

export async function fetchAdminAuditLog(
  offset = 0,
  limit = 100,
  category = "all",
): Promise<{
  entries: AdminAuditLogItem[];
  total: number;
}> {
  const { data } = await api.get<components["schemas"]["AdminAuditLogResponse"]>(
    "/api/v1/admin/audit-log",
    { params: { offset, limit, category } },
  );
  return { entries: data.entries ?? [], total: data.total ?? 0 };
}

export async function fetchAdminAuditLogEntry(entryId: string): Promise<AdminAuditLogItem> {
  const { data } = await api.get<components["schemas"]["AdminAuditLogDetailResponse"]>(
    `/api/v1/admin/audit-log/${entryId}`,
  );
  return data.entry;
}
