"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import {
  fetchReferralSignups,
  patchReferralShoutout,
  type ReferralPartner,
  type ReferralVendorSignup,
  type ShoutoutFilter,
} from "@/lib/adminReferralsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { PUBLIC_SITE_URL } from "@/lib/siteUrl";

const SHOUTOUT_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "pending" as const, label: "Not featured yet" },
  { value: "completed" as const, label: "Shoutout completed" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type AdminReferralSignupsViewProps = {
  partnerId: string;
};

export function AdminReferralSignupsView({ partnerId }: AdminReferralSignupsViewProps) {
  const [partner, setPartner] = useState<ReferralPartner | null>(null);
  const [signups, setSignups] = useState<ReferralVendorSignup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shoutoutFilter, setShoutoutFilter] = useState<ShoutoutFilter>("all");
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchReferralSignups(partnerId, { shoutout: shoutoutFilter, limit: 100 });
      setPartner(data.partner);
      setSignups(data.signups);
      setTotal(data.total);
    } catch {
      setError("Could not load signups for this creator.");
    } finally {
      setLoading(false);
    }
  }, [partnerId, shoutoutFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleShoutout = async (row: ReferralVendorSignup) => {
    setToggleBusyId(row.user_id);
    setError(null);
    const next = !row.shoutout_completed;
    setSignups((prev) =>
      prev.map((s) =>
        s.user_id === row.user_id
          ? { ...s, shoutout_completed: next, shoutout_completed_at: next ? new Date().toISOString() : null }
          : s,
      ),
    );
    try {
      const updated = await patchReferralShoutout(row.user_id, next);
      setSignups((prev) => prev.map((s) => (s.user_id === row.user_id ? updated : s)));
    } catch (err: unknown) {
      setSignups((prev) =>
        prev.map((s) =>
          s.user_id === row.user_id
            ? { ...s, shoutout_completed: row.shoutout_completed, shoutout_completed_at: row.shoutout_completed_at }
            : s,
        ),
      );
      setError(getApiErrorDetail(err) ?? "Could not update shoutout status.");
    } finally {
      setToggleBusyId(null);
    }
  };

  if (loading && !partner) {
    return <AdminLoadingState label="Loading signups…" />;
  }

  if (!partner) {
    return (
      <div className="space-y-4">
        {error ? <AdminErrorBanner message={error} /> : null}
        <BackLink href="/admin/referrals" label="Back to creators" />
        <EmptyState title="Creator not found" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <BackLink href="/admin/referrals" label="Back to creators" />

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">{partner.display_name}</h2>
        {partner.instagram_handle ? (
          <p className="mt-1 text-sm text-neutral-600">{partner.instagram_handle}</p>
        ) : null}
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={() => void navigator.clipboard.writeText(partner.referral_link)}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          {partner.referral_link}
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          Links always use the live site ({PUBLIC_SITE_URL}).
        </p>
      </div>

      <SegmentedControl
        aria-label="Filter signups by shoutout status"
        options={SHOUTOUT_OPTIONS}
        value={shoutoutFilter}
        onChange={setShoutoutFilter}
      />

      {signups.length === 0 ? (
        <EmptyState
          title={shoutoutFilter === "all" ? "No signups yet" : "No vendors match this filter"}
          description={
            shoutoutFilter === "all"
              ? "Vendors who register via this creator's link will appear here."
              : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            {total} signup{total === 1 ? "" : "s"}
          </p>
          <AdminTable>
            <AdminTableElement className="min-w-[48rem]">
              <AdminTableHead>
                <AdminTableHeaderCell>Email</AdminTableHeaderCell>
                <AdminTableHeaderCell>Business</AdminTableHeaderCell>
                <AdminTableHeaderCell>Signed up</AdminTableHeaderCell>
                <AdminTableHeaderCell>Approval</AdminTableHeaderCell>
                <AdminTableHeaderCell>Shoutout</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Profile</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {signups.map((row) => (
                  <AdminTableRow key={row.user_id}>
                    <AdminTableCell>{row.email ?? "—"}</AdminTableCell>
                    <AdminTableCell>{row.business_name ?? "—"}</AdminTableCell>
                    <AdminTableCell>{formatDate(row.attributed_at)}</AdminTableCell>
                    <AdminTableCell>
                      {row.approval_status ? (
                        <VendorApprovalStatusBadge status={row.approval_status} />
                      ) : (
                        "—"
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                          checked={row.shoutout_completed}
                          disabled={toggleBusyId === row.user_id}
                          onChange={() => void onToggleShoutout(row)}
                        />
                        <span className="text-neutral-700">
                          {row.shoutout_completed ? "Completed" : "Pending"}
                        </span>
                      </label>
                      {row.shoutout_completed_at ? (
                        <p className="mt-0.5 text-xs text-neutral-500">{formatDate(row.shoutout_completed_at)}</p>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      {row.explore_path ? (
                        <ButtonLink
                          href={row.explore_path}
                          variant="ghost"
                          size="sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </ButtonLink>
                      ) : (
                        "—"
                      )}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTableElement>
          </AdminTable>
        </>
      )}
    </div>
  );
}
