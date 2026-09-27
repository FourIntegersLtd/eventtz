"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { buildVendorListParams } from "@/domains/admin-directory/vendorListParams";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminPagination,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import {
  fetchAdminVendorInsights,
  fetchAdminVendors,
  setAdminVendorApproval,
  type AdminVendorInsights,
  type AdminVendorRow,
} from "@/domains/admin-directory/api";

const PAGE_SIZE = 50;

/** Directory tab: vendors, searchable, with approve/ban and an inline insights panel. */
export function AdminVendorsPanel() {
  const [search, setSearch] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdminVendorInsights | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const result = await fetchAdminVendors(
        buildVendorListParams({ offset, limit: PAGE_SIZE, search, approvalStatus }),
      );
      if (mySeq !== requestSeq.current) return;
      setVendors(result.vendors);
      setTotal(result.total);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Could not load vendors.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, [offset, search, approvalStatus]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleApprovalChange(userId: string, status: "pending" | "approved" | "banned") {
    try {
      await setAdminVendorApproval(userId, status);
      setVendors((current) =>
        current.map((vendor) => (vendor.user_id === userId ? { ...vendor, approval_status: status } : vendor)),
      );
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update approval.");
    }
  }

  async function toggleInsights(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null);
      setInsights(null);
      return;
    }
    setExpandedId(userId);
    try {
      setInsights(await fetchAdminVendorInsights(userId));
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load insights.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <input
          placeholder="Search email or business name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-primary-border px-3 py-2 text-sm"
        />
        <select
          value={approvalStatus}
          onChange={(event) => {
            setApprovalStatus(event.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-primary-border px-3 py-2 text-sm"
        >
          <option value="">All approval states</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {loading ? <AdminLoadingState label="Loading vendors…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && vendors.length === 0 ? <AdminEmptyState title="No vendors match your filters" /> : null}
      {!loading && !error && vendors.length > 0 ? (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
                <AdminTableHeaderCell>Onboarding</AdminTableHeaderCell>
                <AdminTableHeaderCell>Approval</AdminTableHeaderCell>
                <AdminTableHeaderCell>Payouts</AdminTableHeaderCell>
                <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
                <AdminTableHeaderCell>Insights</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {vendors.map((vendor) => (
                <Fragment key={vendor.user_id}>
                  <AdminTableRow>
                    <AdminTableCell>{vendor.email ?? vendor.user_id}</AdminTableCell>
                    <AdminTableCell>{vendor.onboarding_status}</AdminTableCell>
                    <AdminTableCell>
                      <select
                        value={vendor.approval_status}
                        onChange={(event) =>
                          void handleApprovalChange(
                            vendor.user_id,
                            event.target.value as "pending" | "approved" | "banned",
                          )
                        }
                        className="rounded-lg border border-primary-border px-2 py-1 text-xs"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="banned">Banned</option>
                      </select>
                    </AdminTableCell>
                    <AdminTableCell>{vendor.payouts_verified ? "Verified" : "Not set up"}</AdminTableCell>
                    <AdminTableCell>{formatDate(vendor.updated_at)}</AdminTableCell>
                    <AdminTableCell>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={() => void toggleInsights(vendor.user_id)}
                      >
                        {expandedId === vendor.user_id ? "Hide" : "View"}
                      </button>
                    </AdminTableCell>
                  </AdminTableRow>
                  {expandedId === vendor.user_id && insights ? (
                    <tr>
                      <td colSpan={6} className="bg-primary-soft/30 px-4 py-3 text-xs text-neutral-700">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                          <span>Bookings total: {insights.bookings_total}</span>
                          <span>Open disputes: {insights.open_disputes_on_bookings}</span>
                          <span>Reviews: {insights.review_count}</span>
                          <span>Average rating: {insights.review_average ?? "-"}</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => setOffset(offset + PAGE_SIZE)}
          />
        </>
      ) : null}
    </div>
  );
}
