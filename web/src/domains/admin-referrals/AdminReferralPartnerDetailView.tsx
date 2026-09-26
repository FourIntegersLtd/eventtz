"use client";

import { useCallback, useEffect, useState } from "react";
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
import { fetchReferralSignups, setReferralShoutout, type ReferralPartnerRow, type ReferralVendorSignupRow } from "@/domains/admin-referrals/api";

/** `/admin/referrals/[partnerId]` — the vendors one partner brought in, with shout-out tracking. */
export function AdminReferralPartnerDetailView({ partnerId }: { partnerId: string }) {
  const [partner, setPartner] = useState<ReferralPartnerRow | null>(null);
  const [signups, setSignups] = useState<ReferralVendorSignupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      const result = await fetchReferralSignups(partnerId);
      setPartner(result.partner);
      setSignups(result.signups);
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Not found.");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleToggleShoutout(signup: ReferralVendorSignupRow) {
    try {
      await setReferralShoutout(signup.user_id, !signup.shoutout_completed);
      setSignups((current) =>
        current.map((row) =>
          row.user_id === signup.user_id ? { ...row, shoutout_completed: !row.shoutout_completed } : row,
        ),
      );
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update the shout-out.");
    }
  }

  if (loading) return <AdminLoadingState label="Loading signups…" />;
  if (error || !partner) return <AdminErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <h2 className="text-lg font-semibold text-neutral-900">{partner.display_name}</h2>
        <p className="text-sm text-neutral-500">{partner.referral_link}</p>
      </div>
      {signups.length === 0 ? (
        <AdminEmptyState title="No vendors have signed up through this partner yet" />
      ) : (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
              <AdminTableHeaderCell>Signed up</AdminTableHeaderCell>
              <AdminTableHeaderCell>Approval</AdminTableHeaderCell>
              <AdminTableHeaderCell>Shout-out</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {signups.map((signup) => (
              <AdminTableRow key={signup.user_id}>
                <AdminTableCell>
                  {signup.business_name ?? signup.email ?? signup.user_id}
                  <div className="text-xs text-neutral-500">{signup.email ?? ""}</div>
                </AdminTableCell>
                <AdminTableCell>{formatDate(signup.attributed_at)}</AdminTableCell>
                <AdminTableCell>{signup.approval_status ?? "-"}</AdminTableCell>
                <AdminTableCell>
                  <button
                    type="button"
                    onClick={() => void handleToggleShoutout(signup)}
                    className={
                      signup.shoutout_completed
                        ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                        : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
                    }
                  >
                    {signup.shoutout_completed ? "Thanked" : "Mark thanked"}
                  </button>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  );
}
