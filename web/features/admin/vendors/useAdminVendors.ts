"use client";

import { useCallback, useMemo, useState } from "react";
import { serverListKey, useServerList } from "@/lib/useServerList";
import { vendorQueueFilters, type VendorQueueTab } from "@/features/admin/vendors/adminVendorQueueStatus";
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

/** What the queue tab and search box narrow the list to; sent to the api as query parameters. */
type AdminVendorListFilters = {
  approvalStatus: string | undefined;
  profileStatus: string | undefined;
  returnedForEdits: boolean | undefined;
};

/**
 * The admin vendors list: a server-paged list (`useServerList`) narrowed by a queue tab and a search,
 * plus the bulk selection and reminder emails that act on the rows of the current page.
 */
export function useAdminVendors(initialQueueTab: VendorQueueTab) {
  const [queueTab, setQueueTab] = useState<VendorQueueTab>(initialQueueTab);
  const [search, setSearch] = useState("");
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  const queueFilters = vendorQueueFilters(queueTab);
  const filters: AdminVendorListFilters = {
    approvalStatus: queueFilters.approvalStatus || undefined,
    profileStatus: queueFilters.profileStatus || undefined,
    returnedForEdits: queueFilters.returnedForEdits,
  };

  const list = useServerList<AdminVendorRow, AdminVendorListFilters>({
    filters,
    search,
    errorMessage: "Could not load vendors.",
    fetchPage: async ({ offset, limit, filters: active, search: text }) => {
      const query: AdminVendorsQuery = {
        offset,
        limit,
        q: text || undefined,
        approval_status: active.approvalStatus,
        status: active.profileStatus,
        returned_for_edits: active.returnedForEdits,
      };
      const response = await fetchAdminVendors(query);
      return { items: response.vendors, total: response.total };
    },
  });
  const rows = list.items;

  // The selection belongs to one page of one filter: moving to another page or filter clears it.
  const pageKey = `${serverListKey(filters, search)}|${list.offset}`;
  const [selection, setSelection] = useState<{ pageKey: string; ids: string[] }>({
    pageKey,
    ids: [],
  });
  const selectedUserIds = useMemo(
    () => (selection.pageKey === pageKey ? selection.ids : []),
    [selection, pageKey],
  );
  const setSelectedUserIds = useCallback(
    (update: (previous: string[]) => string[]) =>
      setSelection((previous) => ({
        pageKey,
        ids: update(previous.pageKey === pageKey ? previous.ids : []),
      })),
    [pageKey],
  );

  const selectableUserIdsOnPage = useMemo(
    () => rows.filter(vendorIsBulkEmailSelectable).map((row) => row.user_id),
    [rows],
  );

  const rowByUserId = useMemo(() => new Map(rows.map((row) => [row.user_id, row])), [rows]);

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

  const toggleSelectedUserId = useCallback((userId: string, selected: boolean) => {
    setSelectedUserIds((prev) => {
      if (selected) return prev.includes(userId) ? prev : [...prev, userId];
      return prev.filter((id) => id !== userId);
    });
  }, [setSelectedUserIds]);

  const selectAllSelectableOnPage = useCallback(() => {
    setSelectedUserIds((prev) => [...new Set([...prev, ...selectableUserIdsOnPage])]);
  }, [selectableUserIdsOnPage, setSelectedUserIds]);

  const clearSelectableOnPage = useCallback(() => {
    const selectableSet = new Set(selectableUserIdsOnPage);
    setSelectedUserIds((prev) => prev.filter((id) => !selectableSet.has(id)));
  }, [selectableUserIdsOnPage, setSelectedUserIds]);

  /** Sends one kind of reminder to the selected vendors, then clears the selection. */
  const sendNudge = useCallback(
    async (
      post: (userIds: string[]) => Promise<AdminVendorProfileNudgeResult>,
      fallbackMessage: string,
    ): Promise<
      | { kind: "result"; result: AdminVendorProfileNudgeResult }
      | { kind: "error"; message: string }
      | null
    > => {
      if (selectedUserIds.length === 0) return null;
      setNudgeBusy(true);
      setNudgeError(null);
      try {
        const result = await post(selectedUserIds);
        setSelectedUserIds(() => []);
        return { kind: "result", result };
      } catch (e) {
        const message = getApiErrorDetail(e) ?? fallbackMessage;
        setNudgeError(message);
        return { kind: "error", message };
      } finally {
        setNudgeBusy(false);
      }
    },
    [selectedUserIds, setSelectedUserIds],
  );

  const nudgeDraftVendors = useCallback(
    () => sendNudge(postAdminVendorProfileNudge, "Could not send profile reminder emails."),
    [sendNudge],
  );

  const nudgePayoutVendors = useCallback(
    () => sendNudge(postAdminVendorPayoutNudge, "Could not send payout reminder emails."),
    [sendNudge],
  );

  return {
    rows,
    total: list.total,
    offset: list.offset,
    limit: list.limit,
    goPrevious: list.goPrevious,
    goNext: list.goNext,
    loading: list.loading,
    error: nudgeError ?? list.error,
    search,
    setSearch,
    queueTab,
    setQueueTab,
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
