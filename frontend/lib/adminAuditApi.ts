import api from "@/lib/axios";

export type AdminAuditLogItem = {
  id: string;
  admin_user_id?: string | null;
  admin_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

export async function fetchAdminAuditLog(
  offset = 0,
  limit = 100,
  category = "all",
): Promise<{
  entries: AdminAuditLogItem[];
  total: number;
}> {
  const { data } = await api.get<{
    success: boolean;
    entries: AdminAuditLogItem[];
    total: number;
  }>("/api/v1/admin/audit-log", { params: { offset, limit, category } });
  return { entries: data.entries ?? [], total: data.total ?? 0 };
}

export async function fetchAdminAuditLogEntry(entryId: string): Promise<AdminAuditLogItem> {
  const { data } = await api.get<{ success: boolean; entry: AdminAuditLogItem }>(
    `/api/v1/admin/audit-log/${entryId}`,
  );
  return data.entry;
}
