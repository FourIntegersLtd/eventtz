"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { referralSlugPreview } from "@/domains/admin-referrals/referralSlugPreview";
import Link from "next/link";
import { Button, TextField } from "@/foundation/ui";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { createReferralPartner, fetchReferralPartners, updateReferralPartner, type ReferralPartnerRow } from "@/domains/admin-referrals/api";

/** `/admin/referrals` — partner creators who bring vendors to the marketplace. */
export function AdminReferralsListView() {
  const [partners, setPartners] = useState<ReferralPartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const rows = await fetchReferralPartners();
      if (mySeq !== requestSeq.current) return;
      setPartners(rows);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Could not load partners.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleCreate() {
    if (!displayName.trim()) return;
    setCreating(true);
    try {
      const partner = await createReferralPartner({
        display_name: displayName.trim(),
        instagram_handle: instagramHandle.trim() || null,
      });
      setPartners((current) => [partner, ...current]);
      setDisplayName("");
      setInstagramHandle("");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not add the partner.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(partner: ReferralPartnerRow) {
    try {
      const updated = await updateReferralPartner(partner.id, { is_active: !partner.is_active });
      setPartners((current) => current.map((row) => (row.id === partner.id ? updated : row)));
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update the partner.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary-border bg-white p-4">
        <TextField label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <TextField
          label="Instagram handle"
          value={instagramHandle}
          onChange={(event) => setInstagramHandle(event.target.value)}
        />
        <Button loading={creating} disabled={!displayName.trim()} onClick={() => void handleCreate()}>
          Add partner
        </Button>
        <p className="w-full text-xs text-neutral-500">
          Link slug preview: <span className="font-mono">{referralSlugPreview(displayName)}</span>
        </p>
      </div>

      {loading ? <AdminLoadingState label="Loading partners…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && partners.length === 0 ? <AdminEmptyState title="No referral partners yet" /> : null}
      {!loading && !error && partners.length > 0 ? (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Partner</AdminTableHeaderCell>
              <AdminTableHeaderCell>Link</AdminTableHeaderCell>
              <AdminTableHeaderCell>Added</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Signups</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {partners.map((partner) => (
              <AdminTableRow key={partner.id}>
                <AdminTableCell>
                  {partner.display_name}
                  <div className="text-xs text-neutral-500">{partner.instagram_handle ?? ""}</div>
                </AdminTableCell>
                <AdminTableCell>
                  <code className="text-xs">{partner.referral_link}</code>
                </AdminTableCell>
                <AdminTableCell>{formatDate(partner.created_at)}</AdminTableCell>
                <AdminTableCell>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(partner)}
                    className={
                      partner.is_active
                        ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                        : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
                    }
                  >
                    {partner.is_active ? "Active" : "Inactive"}
                  </button>
                </AdminTableCell>
                <AdminTableCell>
                  <Link href={`/admin/referrals/${partner.id}`} className="font-medium text-primary hover:underline">
                    View signups
                  </Link>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      ) : null}
    </div>
  );
}
