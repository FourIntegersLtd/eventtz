"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import {
  adminFilterControlClass,
  adminFilterControlClassLg36,
} from "@/features/admin/components/adminFilterControlClass";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminVendorsTable } from "@/features/admin/vendors/AdminVendorsTable";
import { useAdminVendors } from "@/features/admin/vendors/useAdminVendors";
import type { AdminVendorProfileNudgeResult } from "@/lib/adminVendorsApi";

const APPROVAL_STATUSES = ["", "pending", "approved", "banned"];
const PROFILE_STATUSES = ["", "draft", "submitted", "complete"];

type NudgeKind = "profile" | "payout";

function nudgeToastCopy(
  kind: NudgeKind,
  result: AdminVendorProfileNudgeResult,
): {
  title: string;
  description: string;
  tone: "success" | "error" | "neutral";
} {
  const { sent, skipped, failures } = result;
  const parts: string[] = [];
  const skippedLabel =
    kind === "profile" ? "skipped (not draft)." : "skipped (payouts set up or not approved).";

  if (sent > 0) {
    parts.push(`Sent ${sent} email${sent === 1 ? "" : "s"}.`);
  }
  if (skipped > 0) {
    parts.push(`${skipped} ${skippedLabel}`);
  }
  if (failures.length > 0) {
    const reasons = [...new Set(failures.map((f) => f.error).filter(Boolean))];
    const reasonHint = reasons.length > 0 ? ` ${reasons.join("; ")}.` : "";
    parts.push(`${failures.length} failed.${reasonHint}`);
  }

  const description = parts.join(" ") || "No emails were sent.";
  const label = kind === "profile" ? "profile" : "payout";

  if (sent > 0 && failures.length === 0) {
    return { title: `${label} emails sent`, description, tone: "success" };
  }
  if (sent > 0) {
    return { title: `${label} emails partly sent`, description, tone: "neutral" };
  }
  if (failures.length > 0 || skipped > 0) {
    return { title: `Could not send ${label} emails`, description, tone: "error" };
  }
  return { title: `No ${label} emails sent`, description, tone: "neutral" };
}

export function AdminVendorsView() {
  const { showToast } = useToast();
  const {
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
  } = useAdminVendors();

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const runNudge = async (kind: NudgeKind) => {
    const outcome = kind === "profile" ? await nudgeDraftVendors() : await nudgePayoutVendors();
    if (!outcome) return;
    if (outcome.kind === "error") {
      showToast({
        title:
          kind === "profile"
            ? "Could not send profile emails"
            : "Could not send payout emails",
        description: outcome.message,
        tone: "error",
        durationMs: 7000,
      });
      return;
    }
    const toast = nudgeToastCopy(kind, outcome.result);
    showToast({
      title: toast.title,
      description: toast.description,
      tone: toast.tone,
      durationMs: toast.tone === "error" ? 7000 : 6000,
    });
  };

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
            className={adminFilterControlClass}
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
            className={adminFilterControlClassLg36}
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
            className={adminFilterControlClassLg36}
          >
            {PROFILE_STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
      </AdminFilterBar>

      {selectedUserIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm text-neutral-700">
            {selectedUserIds.length} vendor{selectedUserIds.length === 1 ? "" : "s"} selected
            {selectedDraftCount > 0 || selectedPayoutCount > 0 ? (
              <span className="text-neutral-500">
                {" "}
                (
                {[
                  selectedDraftCount > 0 ? `${selectedDraftCount} draft` : null,
                  selectedPayoutCount > 0 ? `${selectedPayoutCount} need payouts` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                )
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDraftCount > 0 ? (
              <button
                type="button"
                disabled={nudgeBusy}
                onClick={() => void runNudge("profile")}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {nudgeBusy ? "Sending…" : "Send complete profile email"}
              </button>
            ) : null}
            {selectedPayoutCount > 0 ? (
              <button
                type="button"
                disabled={nudgeBusy}
                onClick={() => void runNudge("payout")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {nudgeBusy ? "Sending…" : "Send setup payouts email"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <AdminLoadingState label="Loading vendors…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No vendors match your filters" lottie="searchNoResults" />
      ) : (
        <>
          <AdminVendorsTable
            rows={rows}
            selectedUserIds={selectedUserIds}
            selectableUserIdsOnPage={selectableUserIdsOnPage}
            onToggleSelected={toggleSelectedUserId}
            onSelectAllSelectable={selectAllSelectableOnPage}
            onClearSelectableOnPage={clearSelectableOnPage}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
            <span>
              Showing {rows.length ? offset + 1 : 0}-{offset + rows.length} of {total}
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
    </div>
  );
}
