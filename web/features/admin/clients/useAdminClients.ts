"use client";

import { useState } from "react";
import { fetchAdminClients, type AdminClientRow } from "@/lib/adminPlatformApi";
import { useServerList } from "@/lib/useServerList";

/** Account-status filter value: "" is every client, "true" suspended only, "false" active only. */
export type ClientSuspendedFilter = "" | "true" | "false";

/** The admin clients directory: server-paged rows plus the email search and status filter. */
export function useAdminClients() {
  const [search, setSearch] = useState("");
  const [suspendedFilter, setSuspendedFilter] = useState<ClientSuspendedFilter>("");

  const list = useServerList<AdminClientRow, { suspended: ClientSuspendedFilter }>({
    filters: { suspended: suspendedFilter },
    search,
    errorMessage: "Could not load clients.",
    fetchPage: async ({ offset, limit, filters, search: query }) => {
      const page = await fetchAdminClients({
        offset,
        limit,
        q: query || undefined,
        suspended: filters.suspended === "" ? undefined : filters.suspended === "true",
      });
      return { items: page.clients, total: page.total };
    },
  });

  return {
    rows: list.items,
    total: list.total,
    offset: list.offset,
    limit: list.limit,
    loading: list.loading,
    error: list.error,
    goNext: list.goNext,
    goPrevious: list.goPrevious,
    reload: list.reload,
    search,
    setSearch,
    suspendedFilter,
    setSuspendedFilter,
  };
}
