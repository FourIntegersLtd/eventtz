"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminClients,
  type AdminClientRow,
  type AdminClientsQuery,
} from "@/lib/adminPlatformApi";

export function useAdminClients() {
  const [rows, setRows] = useState<AdminClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [suspendedFilter, setSuspendedFilter] = useState<"" | "true" | "false">("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const q: AdminClientsQuery = {
        offset,
        limit,
        q: search.trim() || undefined,
        suspended:
          suspendedFilter === "true" ? true : suspendedFilter === "false" ? false : undefined,
      };
      const res = await fetchAdminClients(q);
      setRows(res.clients);
      setTotal(res.total);
    } catch {
      setError("Could not load clients.");
    } finally {
      setLoading(false);
    }
  }, [offset, limit, search, suspendedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    search,
    setSearch,
    suspendedFilter,
    setSuspendedFilter,
    reload: load,
  };
}
