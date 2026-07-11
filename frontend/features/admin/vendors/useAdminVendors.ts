"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminVendors,
  patchVendorApproval,
  type AdminVendorRow
} from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";

export function useAdminVendors() {
  const [rows, setRows] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchAdminVendors();
      setRows(list);
      setSelectedUserId((prev) =>
        prev && list.some((r) => r.user_id === prev) ? prev : null,
      );
    } catch {
      setError("Could not load vendors.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setApproval = useCallback(
    async (userId: string, approval_status: VendorApprovalStatus) => {
      setBusyId(userId);
      try {
        await patchVendorApproval(userId, approval_status);
        await load();
      } catch {
        setError("Could not update approval.");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const selectedVendor = useMemo(
    () => rows.find((r) => r.user_id === selectedUserId) ?? null,
    [rows, selectedUserId],
  );

  return {
    rows,
    loading,
    error,
    busyId,
    selectedUserId,
    selectedVendor,
    setSelectedUserId,
    setApproval,
  };
}
