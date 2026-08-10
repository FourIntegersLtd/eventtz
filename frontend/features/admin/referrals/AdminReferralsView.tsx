"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminCreateReferralPartnerModal } from "@/features/admin/referrals/AdminCreateReferralPartnerModal";
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
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
          setCopyNote(`Created link for ${partner.display_name}.`);
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
          <AdminTableElement className="min-w-[44rem]">
            <AdminTableHead>
              <AdminTableHeaderCell>Creator</AdminTableHeaderCell>
              <AdminTableHeaderCell>Instagram</AdminTableHeaderCell>
              <AdminTableHeaderCell>Link</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Created</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {partners.map((p) => (
                <AdminTableRow key={p.id}>
                  <AdminTableCell className="font-medium text-neutral-900">{p.display_name}</AdminTableCell>
                  <AdminTableCell>{p.instagram_handle || "—"}</AdminTableCell>
                  <AdminTableCell>
                    <button
                      type="button"
                      className="inline-flex max-w-[14rem] items-center gap-1 truncate text-left text-sm text-primary hover:underline"
                      onClick={() => {
                        void copyText(p.referral_link).then(() =>
                          setCopyNote(`Copied link for ${p.display_name}.`),
                        );
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{p.referral_link}</span>
                    </button>
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
