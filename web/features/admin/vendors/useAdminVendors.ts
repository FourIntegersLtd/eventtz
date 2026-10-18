"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminVendors,
  type AdminVendorRow,
  type AdminVendorsQuery,
  postAdminVendorPayoutNudge,
  postAdminVendorProfileNudge,
  type AdminVendorProfileNudgeResult,
} from "@/lib/adminVendorsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  vendorIsBulkEmailSelectable,
  vendorIsDraft,
  vendorNeedsPayoutSetup,
} from "@/features/admin/vendors/adminVendorBulkEmail";

export function useAdminVendors() {
  const [rows, setRows] = useState<AdminVendorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nudgeBusy, setNudgeBusy] = useState(false);

  const selectableUserIdsOnPage = useMemo(
    () => rows.filter(vendorIsBulkEmailSelectable).map((r) => r.user_id),
    [rows],
  );

  const rowByUserId = useMemo(() => new Map(rows.map((r) => [r.user_id, r])), [rows]);

  const selectedDraftCount = useMemo(
    () =>
      selectedUserIds.filter((id) => {
        const row = rowByUserId.get(id);
        return row ? vendorIsDraft(row) : false;
      }).length,
    [rowByUserId, selectedUserIds],
  );

  const selectedPayoutCount = useMemo(
    () =>
      selectedUserIds.filter((id) => {
        const row = rowByUserId.get(id);
        return row ? vendorNeedsPayoutSetup(row) : false;
      }).length,
    [rowByUserId, selectedUserIds],
  );

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
      setSelectedUserIds((prev) =>
        prev.filter((id) => res.vendors.some((r) => r.user_id === id)),
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

  const toggleSelectedUserId = useCallback((userId: string, selected: boolean) => {
    setSelectedUserIds((prev) => {
      if (selected) return prev.includes(userId) ? prev : [...prev, userId];
      return prev.filter((id) => id !== userId);
    });
  }, []);

  const selectAllSelectableOnPage = useCallback(() => {
    setSelectedUserIds((prev) => [...new Set([...prev, ...selectableUserIdsOnPage])]);
  }, [selectableUserIdsOnPage]);

  const clearSelectableOnPage = useCallback(() => {
    const selectableSet = new Set(selectableUserIdsOnPage);
    setSelectedUserIds((prev) => prev.filter((id) => !selectableSet.has(id)));
  }, [selectableUserIdsOnPage]);

  const nudgeDraftVendors = useCallback(async (): Promise<
    | { kind: "result"; result: AdminVendorProfileNudgeResult }
    | { kind: "error"; message: string }
    | null
  > => {
    if (selectedUserIds.length === 0) return null;
    setNudgeBusy(true);
    setError(null);
    try {
      const result = await postAdminVendorProfileNudge(selectedUserIds);
      setSelectedUserIds([]);
      return { kind: "result", result };
    } catch (e) {
      const message = getApiErrorDetail(e) ?? "Could not send profile reminder emails.";
      setError(message);
      return { kind: "error", message };
    } finally {
      setNudgeBusy(false);
    }
  }, [selectedUserIds]);

  const nudgePayoutVendors = useCallback(async (): Promise<
    | { kind: "result"; result: AdminVendorProfileNudgeResult }
    | { kind: "error"; message: string }
    | null
  > => {
    if (selectedUserIds.length === 0) return null;
    setNudgeBusy(true);
    setError(null);
    try {
      const result = await postAdminVendorPayoutNudge(selectedUserIds);
      setSelectedUserIds([]);
      return { kind: "result", result };
    } catch (e) {
      const message = getApiErrorDetail(e) ?? "Could not send payout reminder emails.";
      setError(message);
      return { kind: "error", message };
    } finally {
      setNudgeBusy(false);
    }
  }, [selectedUserIds]);

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
    approvalStatus,
    setApprovalStatus,
    profileStatus,
    setProfileStatus,
    selectedUserIds,
    selectableUserIdsOnPage,
    selectedDraftCount,
    selectedPayoutCount,
    toggleSelectedUserId,
    selectAllSelectableOnPage,
    clearSelectableOnPage,
    nudgeDraftVendors,
    nudgePayoutVendors,
    nudgeBusy,
  };
}
