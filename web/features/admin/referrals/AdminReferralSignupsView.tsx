"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
// lucide-react 1.x dropped brand logos, so the Instagram mark comes from react-icons.
import { Link2, type LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import { SiInstagram } from "react-icons/si";
import { useToast } from "@/components/ui/Toast";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VendorApprovalStatusBadge } from "@/components/badges/VendorApprovalStatusBadge";
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

function CreatorDetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon | IconType;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
      </div>
    </div>
  );
}

const SHOUTOUT_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "pending" as const, label: "Not featured yet" },
  { value: "completed" as const, label: "Shoutout completed" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type AdminReferralSignupsViewProps = {
  partnerId: string;
};

export function AdminReferralSignupsView({ partnerId }: AdminReferralSignupsViewProps) {
  const { showToast } = useToast();
  const [partner, setPartner] = useState<ReferralPartner | null>(null);
  const [signups, setSignups] = useState<ReferralVendorSignup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shoutoutFilter, setShoutoutFilter] = useState<ShoutoutFilter>("all");
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

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
      showToast({
        title: next ? "Shoutout marked complete" : "Shoutout marked pending",
        tone: "success",
      });
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
      {copyNote ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {copyNote}
        </div>
      ) : null}
      <BackLink href="/admin/referrals" label="Back to creators" />

      <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col items-center gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center">
          <LottieIllustration asset="welcome" size="status" className="mx-0 h-24 w-24 shrink-0 sm:h-28 sm:w-28" ariaLabel="" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Creator referral</p>
            <p className="font-heading text-lg font-semibold text-neutral-900">{partner.display_name}</p>
          </div>
        </div>
        <div className="space-y-4">
          <CreatorDetailRow icon={SiInstagram} label="Instagram handle">
            {partner.instagram_handle ? (
              <span>{partner.instagram_handle}</span>
            ) : (
              <span className="text-neutral-400">Not set</span>
            )}
          </CreatorDetailRow>

          <CreatorDetailRow icon={Link2} label="Vendor signup link">
            <div className="flex items-start gap-1.5">
              <p className="min-w-0 flex-1 break-all text-neutral-700">{partner.referral_link}</p>
              <CopyReferralLinkButton
                link={partner.referral_link}
                onCopied={() => setCopyNote("Vendor signup link copied.")}
              />
            </div>
          </CreatorDetailRow>
        </div>
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
                    <AdminTableCell>{row.email ?? "-"}</AdminTableCell>
                    <AdminTableCell>{row.business_name ?? "-"}</AdminTableCell>
                    <AdminTableCell>{formatDate(row.attributed_at)}</AdminTableCell>
                    <AdminTableCell>
                      {row.approval_status ? (
                        <VendorApprovalStatusBadge status={row.approval_status} />
                      ) : (
                        "-"
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
                        "-"
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
