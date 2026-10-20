"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminCreateReferralPartnerModal } from "@/features/admin/referrals/AdminCreateReferralPartnerModal";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { AdminSuccessBanner } from "@/features/admin/components/AdminSuccessBanner";
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
  ADMIN_REFERRAL_PARTNERS_PAGE_SIZE,
  fetchReferralPartnersPage,
  type ReferralPartner,
} from "@/lib/adminReferralsApi";
import { TablePagination } from "@/components/ui/TablePagination";
import { copyToClipboard } from "@/lib/copyToClipboard";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
          <AdminKpiCard
            label="Active creators"
            value={partners.filter((p) => p.is_active).length}
          />
          <AdminKpiCard label="Creator links" value={total} />
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
        <AdminTable>
          <AdminTableElement className="min-w-[48rem]">
            <AdminTableHead>
              <AdminTableHeaderCell>Creator</AdminTableHeaderCell>
              <AdminTableHeaderCell>Instagram</AdminTableHeaderCell>
              <AdminTableHeaderCell className="min-w-[16rem]">Vendor signup link</AdminTableHeaderCell>
              <AdminTableHeaderCell className="ez-td-status">Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Created</AdminTableHeaderCell>
              <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {partners.map((p) => (
                <AdminTableRow key={p.id}>
                  <AdminTableCell className="font-medium text-neutral-900">{p.display_name}</AdminTableCell>
                  <AdminTableCell>{p.instagram_handle || "-"}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 truncate text-xs text-neutral-600" title={p.referral_link}>
                        {p.referral_link}
                      </span>
                      <CopyReferralLinkButton
                        link={p.referral_link}
                        onCopied={() => onLinkCopied(p.display_name)}
                      />
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="ez-td-status">
                    {p.is_active ? "Active" : "Inactive"}
                  </AdminTableCell>
                  <AdminTableCell>{formatDate(p.created_at)}</AdminTableCell>
                  <AdminTableCell>
                    <Link
                      href={`/admin/referrals/${p.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View signups
                    </Link>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
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
