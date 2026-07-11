"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminDashboardSummary,
  type AdminDashboardSummary,
} from "@/lib/adminPlatformApi";

export function useAdminDashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await fetchAdminDashboardSummary();
      setSummary(s);
    } catch {
      setError("Could not load dashboard.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}
