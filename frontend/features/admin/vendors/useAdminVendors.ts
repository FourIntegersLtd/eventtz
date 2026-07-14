"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminVendors,
  patchVendorApproval,
  type AdminVendorRow,
  type AdminVendorsQuery,
} from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";

export function useAdminVendors() {
  const [rows, setRows] = useState<AdminVendorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const q: AdminVendorsQuery = {
        offset,
        limit,
        q: search.trim() || undefined,
        approval_status: approvalStatus || undefined,
        status: profileStatus || undefined,
      };
      const res = await fetchAdminVendors(q);
      setRows(res.vendors);
      setTotal(res.total);
      setSelectedUserId((prev) =>
        prev && res.vendors.some((r) => r.user_id === prev) ? prev : null,
      );
    } catch {
      setError("Could not load vendors.");
    } finally {
      setLoading(false);
    }
  }, [offset, limit, search, approvalStatus, profileStatus]);

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
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    busyId,
    selectedUserId,
    selectedVendor,
    setSelectedUserId,
    setApproval,
    search,
    setSearch,
    approvalStatus,
    setApprovalStatus,
    profileStatus,
    setProfileStatus,
  };
}
