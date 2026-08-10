"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminVendors,
  patchVendorApproval,
  patchVendorListingOverride,
  patchVendorUnsubmit,
  type AdminVendorRow,
  type AdminVendorUnsubmitResult,
  type AdminVendorsQuery,
} from "@/lib/adminVendorsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

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
      setError(null);
      try {
        await patchVendorApproval(userId, approval_status);
        track(MixpanelEvents.admin_vendor_approval_set, {
          vendor_user_id: userId,
          approval_status,
        });
        await load();
        return true;
      } catch {
        setError("Could not update approval.");
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const setListingOverride = useCallback(
    async (userId: string, listing_override: VendorListingOverride, reason?: string) => {
      setBusyId(userId);
      setError(null);
      try {
        await patchVendorListingOverride(userId, listing_override, reason);
        track(MixpanelEvents.admin_vendor_listing_override_set, {
          vendor_user_id: userId,
          listing_override,
        });
        await load();
        return true;
      } catch (e) {
        setError(getApiErrorDetail(e) ?? "Could not update listing visibility.");
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const unsubmitVendor = useCallback(
    async (
      userId: string,
      options?: { message?: string },
    ): Promise<AdminVendorUnsubmitResult | null> => {
      setBusyId(userId);
      setError(null);
      try {
        const result = await patchVendorUnsubmit(userId, { message: options?.message });
        await load();
        return result;
      } catch (e) {
        setError(getApiErrorDetail(e) ?? "Could not return vendor to draft.");
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const reportError = useCallback((message: string) => {
    setError(message);
  }, []);

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
    setListingOverride,
    unsubmitVendor,
    reportError,
    search,
    setSearch,
    approvalStatus,
    setApprovalStatus,
    profileStatus,
    setProfileStatus,
  };
}
