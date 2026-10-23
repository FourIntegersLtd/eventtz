"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminCreateReferralPartnerModal } from "@/features/admin/referrals/AdminCreateReferralPartnerModal";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { StatTile } from "@/components/ui/StatTile";
import { AdminSuccessBanner } from "@/features/admin/components/AdminSuccessBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
import {
  ADMIN_REFERRAL_PARTNERS_PAGE_SIZE,
  fetchReferralPartnersPage,
  type ReferralPartner,
} from "@/lib/adminReferralsApi";
import { TablePagination } from "@/components/ui/TablePagination";
import { copyToClipboard } from "@/lib/copyToClipboard";
import { formatDate } from "@/lib/dateFormat";

function formatDay(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return formatDate(d, "dayMonthYear");
}

export function AdminReferralsView() {
  const [partners, setPartners] = useState<ReferralPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchReferralPartnersPage(offset, ADMIN_REFERRAL_PARTNERS_PAGE_SIZE);
      setPartners(page.partners);
      setTotal(page.total);
    } catch {
      setError("Could not load creator links.");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const onLinkCopied = (partnerName: string) => {
    setCopyNote(`Link copied for ${partnerName}.`);
  };

  if (loading && partners.length === 0) {
    return <AdminLoadingState label="Loading referrals…" />;
  }

  return (
    <div className="ez-stack">
      {error ? <AdminErrorBanner message={error} /> : null}
      {copyNote ? <AdminSuccessBanner message={copyNote} /> : null}

      {total > 0 ? (
        <div className="ez-grid-4">
          <StatTile
            label="Active creators"
            value={partners.filter((p) => p.is_active).length}
          />
          <StatTile label="Creator links" value={total} />
        </div>
      ) : null}

      <div className="flex justify-end">
        <div className="ez-pagehead__actions">
          <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
            Create creator link
          </Button>
        </div>
      </div>

      <AdminCreateReferralPartnerModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(partner) => {
          void copyToClipboard(partner.referral_link);
          setCopyNote(`Link copied for ${partner.display_name}.`);
          void load();
        }}
      />

      {total === 0 ? (
        <EmptyState
          title="No creator links yet"
          description="Create your first link to start tracking vendor signups from Instagram creators."
          action={
            <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
              Create creator link
            </Button>
          }
        />
      ) : (
        <DataTable
          aria-label="Creator links"
          tableClassName="min-w-[48rem]"
          rows={partners}
          getRowKey={(partner) => partner.id}
          columns={[
            {
              key: "creator",
              header: "Creator",
              className: "font-medium text-neutral-900",
              cell: (partner) => partner.display_name,
            },
            { key: "instagram", header: "Instagram", cell: (partner) => partner.instagram_handle || "-" },
            {
              key: "link",
              header: "Vendor signup link",
              headerClassName: "min-w-[16rem]",
              cell: (partner) => (
                <div className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 truncate text-xs text-neutral-600" title={partner.referral_link}>
                    {partner.referral_link}
                  </span>
                  <CopyReferralLinkButton
                    link={partner.referral_link}
                    onCopied={() => onLinkCopied(partner.display_name)}
                  />
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              kind: "status",
              cell: (partner) => (partner.is_active ? "Active" : "Inactive"),
            },
            { key: "created", header: "Created", cell: (partner) => formatDay(partner.created_at) },
            {
              key: "actions",
              header: "Actions",
              cell: (partner) => (
                <Link
                  href={`/admin/referrals/${partner.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View signups
                </Link>
              ),
            },
          ]}
        />
      )}

      <TablePagination
        offset={offset}
        limit={ADMIN_REFERRAL_PARTNERS_PAGE_SIZE}
        total={total}
        loading={loading}
        onPrevious={() =>
          setOffset((current) => Math.max(0, current - ADMIN_REFERRAL_PARTNERS_PAGE_SIZE))
        }
        onNext={() => setOffset((current) => current + ADMIN_REFERRAL_PARTNERS_PAGE_SIZE)}
      />
    </div>
  );
}
