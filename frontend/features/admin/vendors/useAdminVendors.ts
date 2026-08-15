"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAdminVendors,
  patchVendorApproval,
  patchVendorListingOverride,
  patchVendorUnsubmit,
  restoreAdminVendorStripeConnect,
  type AdminVendorRow,
  type AdminVendorUnsubmitResult,
  type AdminVendorsQuery,
  postAdminVendorProfileNudge,
  type AdminVendorProfileNudgeResult,
} from "@/lib/adminVendorsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { COULD_NOT_RESTORE_STRIPE_CONNECT } from "@/lib/admin-messages";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export function useAdminVendors() {
  const { showToast } = useToast();
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [nudgeBusy, setNudgeBusy] = useState(false);

  const draftUserIdsOnPage = useMemo(
    () => rows.filter((r) => r.onboarding_status === "draft").map((r) => r.user_id),
    [rows],
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
      setSelectedUserId((prev) =>
        prev && res.vendors.some((r) => r.user_id === prev) ? prev : null,
      );
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
        const labels: Record<VendorApprovalStatus, string> = {
          pending: "Vendor moved to pending review",
          approved: "Vendor approved",
          banned: "Vendor banned",
        };
        showToast({ title: labels[approval_status], tone: "success" });
        return true;
      } catch (e) {
        const message = getApiErrorDetail(e) ?? "Could not update approval.";
        setError(message);
        showToast({ title: "Approval update failed", description: message, tone: "error" });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
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
        const labels: Record<VendorListingOverride, string> = {
          auto: "Listing set to automatic",
          visible: "Vendor published on marketplace",
          hidden: "Vendor hidden from marketplace",
        };
        showToast({ title: labels[listing_override], tone: "success" });
        return true;
      } catch (e) {
        const message = getApiErrorDetail(e) ?? "Could not update listing visibility.";
        setError(message);
        showToast({ title: "Listing update failed", description: message, tone: "error" });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const restoreStripeConnect = useCallback(
    async (userId: string) => {
      setBusyId(userId);
      setError(null);
      try {
        await restoreAdminVendorStripeConnect(userId);
        await load();
        showToast({ title: "Stripe Connect restored", tone: "success" });
        return true;
      } catch (e) {
        setError(getApiErrorDetail(e) ?? COULD_NOT_RESTORE_STRIPE_CONNECT);
        throw e;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
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

  const toggleSelectedUserId = useCallback((userId: string, selected: boolean) => {
    setSelectedUserIds((prev) => {
      if (selected) return prev.includes(userId) ? prev : [...prev, userId];
      return prev.filter((id) => id !== userId);
    });
  }, []);

  const selectAllDraftOnPage = useCallback(() => {
    setSelectedUserIds((prev) => [...new Set([...prev, ...draftUserIdsOnPage])]);
  }, [draftUserIdsOnPage]);

  const clearDraftOnPage = useCallback(() => {
    const draftSet = new Set(draftUserIdsOnPage);
    setSelectedUserIds((prev) => prev.filter((id) => !draftSet.has(id)));
  }, [draftUserIdsOnPage]);

  const clearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

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
    restoreStripeConnect,
    unsubmitVendor,
    reportError,
    search,
    setSearch,
    approvalStatus,
    setApprovalStatus,
    profileStatus,
    setProfileStatus,
    selectedUserIds,
    draftUserIdsOnPage,
    toggleSelectedUserId,
    selectAllDraftOnPage,
    clearDraftOnPage,
    clearSelection,
    nudgeDraftVendors,
    nudgeBusy,
  };
}
