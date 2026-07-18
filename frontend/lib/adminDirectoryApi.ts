import api from "@/lib/axios";

export type AdminClientRow = {
  user_id: string;
  email?: string | null;
  created_at?: string | null;
  account_suspended: boolean;
  booking_count: number;
};

export type AdminClientsQuery = {
  offset?: number;
  limit?: number;
  q?: string;
  suspended?: boolean;
};

export type AdminClientsListResult = {
  clients: AdminClientRow[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchAdminClients(
  q: AdminClientsQuery = {},
): Promise<AdminClientsListResult> {
  const { data } = await api.get<{
    success: boolean;
    clients: AdminClientRow[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/clients", {
    params: {
      offset: q.offset ?? 0,
      limit: q.limit ?? 50,
      q: q.q?.trim() || undefined,
      suspended: q.suspended,
    },
  });
  return {
    clients: data.clients ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    limit: data.limit ?? 50,
  };
}

export type AdminDirectoryUser = {
  user_id: string;
  label: string;
  kind: "client" | "vendor";
  email?: string | null;
};

export async function searchAdminDirectoryUsers(
  q: string,
  opts?: { kinds?: ("client" | "vendor")[]; limit?: number },
): Promise<AdminDirectoryUser[]> {
  const { data } = await api.get<{ success: boolean; users: AdminDirectoryUser[] }>(
    "/api/v1/admin/directory/search",
    {
      params: {
        q,
        kinds: (opts?.kinds ?? ["client", "vendor"]).join(","),
        limit: opts?.limit ?? 20,
      },
    },
  );
  return data.users ?? [];
}

export async function patchClientSuspended(userId: string, suspended: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/clients/${userId}/suspended`, { suspended });
}
