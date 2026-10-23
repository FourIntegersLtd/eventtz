"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
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
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminSuccessBanner } from "@/features/admin/components/AdminSuccessBanner";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
import {
  fetchReferralSignups,
  patchReferralShoutout,
  type ReferralPartner,
  type ReferralVendorSignup,
  type ShoutoutFilter,
} from "@/lib/adminReferralsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { formatDate } from "@/lib/dateFormat";

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

function formatDay(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return formatDate(d, "dayMonthYear");
}

type AdminReferralSignupsViewProps = {
  partnerId: string;
};

const SIGNUPS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export function AdminReferralSignupsView({ partnerId }: AdminReferralSignupsViewProps) {
  const { showToast } = useToast();
  const [partner, setPartner] = useState<ReferralPartner | null>(null);
  const [signups, setSignups] = useState<ReferralVendorSignup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shoutoutFilter, setShoutoutFilter] = useState<ShoutoutFilter>("all");
  const [offset, setOffset] = useState(0);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchReferralSignups(partnerId, {
        shoutout: shoutoutFilter,
        offset,
        limit: SIGNUPS_PAGE_SIZE,
      });
      setPartner(data.partner);
      setSignups(data.signups);
      setTotal(data.total);
    } catch {
      setError("Could not load signups for this creator.");
    } finally {
      setLoading(false);
    }
  }, [partnerId, shoutoutFilter, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [shoutoutFilter, partnerId]);

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
      <div className="ez-stack">
        {error ? <AdminErrorBanner message={error} /> : null}
        <BackLink href="/admin/referrals" label="Back to creators" />
        <EmptyState title="Creator not found" />
      </div>
    );
  }

  return (
    <div className="ez-stack">
      {error ? <AdminErrorBanner message={error} /> : null}
      {copyNote ? <AdminSuccessBanner message={copyNote} /> : null}
      <BackLink href="/admin/referrals" label="Back to creators" />

      <section className="ez-card overflow-hidden">
        <div className="ez-card__body p-4 sm:p-5">
        <div className="mb-4 flex flex-col items-center gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-center">
          <LottieIllustration asset="welcome" size="status" className="mx-0 h-24 w-24 shrink-0 sm:h-28 sm:w-28" ariaLabel="" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Creator referral</p>
            <p className="font-heading text-lg font-semibold text-neutral-900">{partner.display_name}</p>
          </div>
        </div>
        <div className="ez-stack">
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
      </section>

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
          <DataTable
            aria-label="Creator signups"
            tableClassName="min-w-[48rem]"
            rows={signups}
            getRowKey={(row) => row.user_id}
            columns={[
              { key: "email", header: "Email", cell: (row) => row.email ?? "-" },
              { key: "business", header: "Business", cell: (row) => row.business_name ?? "-" },
              { key: "signedUp", header: "Signed up", cell: (row) => formatDay(row.attributed_at) },
              {
                key: "approval",
                header: "Approval",
                cell: (row) =>
                  row.approval_status ? <VendorApprovalStatusBadge status={row.approval_status} /> : "-",
              },
              {
                key: "shoutout",
                header: "Shoutout",
                cell: (row) => (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                        checked={row.shoutout_completed}
                        disabled={toggleBusyId === row.user_id}
                        onChange={() => void onToggleShoutout(row)}
                      />
                      <span className="text-neutral-700">{row.shoutout_completed ? "Completed" : "Pending"}</span>
                    </label>
                    {row.shoutout_completed_at ? (
                      <p className="mt-0.5 text-xs text-neutral-500">{formatDay(row.shoutout_completed_at)}</p>
                    ) : null}
                  </>
                ),
              },
              {
                key: "profile",
                header: "Profile",
                cell: (row) =>
                  row.explore_path ? (
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
                  ),
              },
            ]}
          />
          <TablePagination
            offset={offset}
            limit={SIGNUPS_PAGE_SIZE}
            total={total}
            pageRowCount={signups.length}
            loading={loading}
            onPrevious={() => setOffset((value) => Math.max(0, value - SIGNUPS_PAGE_SIZE))}
            onNext={() => setOffset((value) => value + SIGNUPS_PAGE_SIZE)}
          />
        </>
      )}
    </div>
  );
}
