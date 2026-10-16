"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminDashboardMetrics,
  type AdminDashboardMetrics,
} from "@/lib/adminPlatformApi";
import type { AdminPeriodDays } from "@/features/admin/commerce/commercePeriod";

export function useAdminDashboardMetrics(period: AdminPeriodDays) {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const m = await fetchAdminDashboardMetrics(period);
      setMetrics(m);
    } catch {
      setError("Could not load dashboard metrics.");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return { metrics, loading, error, reload: load };
}
