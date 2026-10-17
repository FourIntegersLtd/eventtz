"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminCreateReferralPartnerModal } from "@/features/admin/referrals/AdminCreateReferralPartnerModal";
import { CopyReferralLinkButton } from "@/features/admin/referrals/CopyReferralLinkButton";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { fetchReferralPartners, type ReferralPartner } from "@/lib/adminReferralsApi";
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

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setPartners(await fetchReferralPartners());
    } catch {
      setError("Could not load creator links.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onLinkCopied = (partnerName: string) => {
    setCopyNote(`Link copied for ${partnerName}.`);
  };

  if (loading) {
    return <AdminLoadingState label="Loading referrals…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      {copyNote ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {copyNote}
        </div>
      ) : null}

      <AdminPageHeader
        subtitle="Create trackable vendor signup links for Instagram creators. Share the link; vendors who register appear under that creator."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
            Create creator link
          </Button>
        }
      />

      <AdminCreateReferralPartnerModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(partner) => {
          void copyToClipboard(partner.referral_link);
          setCopyNote(`Link copied for ${partner.display_name}.`);
          void load();
        }}
      />

      {partners.length === 0 ? (
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
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Created</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
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
                  <AdminTableCell>{p.is_active ? "Active" : "Inactive"}</AdminTableCell>
                  <AdminTableCell>{formatDate(p.created_at)}</AdminTableCell>
                  <AdminTableCell className="text-right">
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
    </div>
  );
}
