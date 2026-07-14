"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminVendorsTable } from "@/features/admin/vendors/AdminVendorsTable";
import { useAdminVendors } from "@/features/admin/vendors/useAdminVendors";
import { VendorDetailsModal } from "@/features/admin/vendors/VendorDetailsModal";

const APPROVAL_STATUSES = ["", "pending", "approved", "banned"];
const PROFILE_STATUSES = ["", "draft", "submitted", "complete"];

export function AdminVendorsView() {
  const {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    busyId,
    selectedVendor,
    setSelectedUserId,
    setApproval,
    search,
    setSearch,
    approvalStatus,
    setApprovalStatus,
    profileStatus,
    setProfileStatus,
  } = useAdminVendors();

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />

      <AdminFilterBar>
        <label className="block w-full min-w-0 max-w-full text-sm lg:min-w-[12rem] lg:flex-1">
          <span className="text-neutral-600">Search email or business</span>
          <input
            value={search}
            onChange={(e) => {
              setOffset(0);
              setSearch(e.target.value);
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Contains…"
          />
        </label>
        <label className="block w-full min-w-0 max-w-full text-sm lg:w-auto">
          <span className="text-neutral-600">Approval</span>
          <select
            value={approvalStatus}
            onChange={(e) => {
              setOffset(0);
              setApprovalStatus(e.target.value);
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm lg:w-36"
          >
            {APPROVAL_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full min-w-0 max-w-full text-sm lg:w-auto">
          <span className="text-neutral-600">Profile</span>
          <select
            value={profileStatus}
            onChange={(e) => {
              setOffset(0);
              setProfileStatus(e.target.value);
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm lg:w-36"
          >
            {PROFILE_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState label="Loading vendors…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No vendors match your filters" />
      ) : (
        <>
          <AdminVendorsTable rows={rows} onSelect={setSelectedUserId} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
            <span>
              Showing {rows.length ? offset + 1 : 0}–{offset + rows.length} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset(offset + limit)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <VendorDetailsModal
        vendor={selectedVendor}
        busyId={busyId}
        onClose={() => setSelectedUserId(null)}
        onSetApproval={(userId, status) => void setApproval(userId, status)}
      />
    </div>
  );
}
