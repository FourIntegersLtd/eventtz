import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminClientRow = components["schemas"]["AdminClientRow"];

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
  const { data } = await api.get<components["schemas"]["AdminClientsListResponse"]>("/api/v1/admin/clients", {
    params: {
      offset: q.offset ?? 0,
      limit: q.limit ?? DEFAULT_LIST_PAGE_SIZE,
      q: q.q?.trim() || undefined,
      suspended: q.suspended,
    },
  });
  return {
    clients: data.clients ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    limit: data.limit ?? DEFAULT_LIST_PAGE_SIZE,
  };
}

export type AdminDirectoryUser = components["schemas"]["AdminDirectoryUserRow"];

export async function searchAdminDirectoryUsers(
  q: string,
  opts?: { kinds?: ("client" | "vendor")[]; limit?: number },
): Promise<AdminDirectoryUser[]> {
  const { data } = await api.get<components["schemas"]["AdminDirectorySearchResponse"]>(
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
  await api.patch(`/api/v1/admin/clients/${userId}/suspended`, { suspended } satisfies components["schemas"]["AdminClientSuspendedBody"]);
}
