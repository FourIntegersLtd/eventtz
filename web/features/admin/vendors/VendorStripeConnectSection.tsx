"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { VendorPayoutStatusBadge } from "@/components/badges/VendorPayoutStatusBadge";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { COULD_NOT_RESTORE_STRIPE_CONNECT } from "@/lib/admin-messages";

type Props = {
  vendor: AdminVendorRow;
  busy: boolean;
  onRestoreStripe?: (userId: string) => Promise<boolean>;
};

function maskAccountId(accountId: string | null | undefined): string {
  if (!accountId) return "Not set";
  if (accountId.length <= 8) return accountId;
  return `…${accountId.slice(-8)}`;
}

export function VendorStripeConnectSection({ vendor, busy, onRestoreStripe }: Props) {
  const { isSuperAdmin } = useAdminPermissions();
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const canRestore =
    isSuperAdmin &&
    !vendor.stripe_account_id &&
    Boolean(onRestoreStripe);

  const handleRestore = async () => {
    if (!onRestoreStripe || restoreBusy) return;
    setRestoreBusy(true);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const ok = await onRestoreStripe(vendor.user_id);
      if (ok) {
        setRestoreSuccess("Stripe Connect restored from the latest payout transfer.");
      }
    } catch (e: unknown) {
      setRestoreError(getApiErrorDetail(e) ?? COULD_NOT_RESTORE_STRIPE_CONNECT);
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Stripe Connect</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Payout account — separate from Explore listing visibility
            </p>
          </div>
          <VendorPayoutStatusBadge verified={vendor.payouts_verified} />
        </div>
      </div>
      <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
        <div>
          <dt className="text-xs font-medium text-neutral-500">Account ID</dt>
          <dd className="mt-0.5 font-mono text-neutral-900">{maskAccountId(vendor.stripe_account_id)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Charges enabled</dt>
          <dd className="mt-0.5 text-neutral-900">
            {vendor.stripe_charges_enabled ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500">Payouts enabled</dt>
          <dd className="mt-0.5 text-neutral-900">
            {vendor.stripe_payouts_enabled ? "Yes" : "No"}
          </dd>
        </div>
      </dl>
      <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:px-5">
        <p className="text-xs leading-relaxed text-neutral-600">
          Hiding a listing does not remove Stripe Connect. If the account ID is missing after a
          payout, restore it from the booking transfer (super admin).
        </p>
        {restoreError ? (
          <p className="mt-2 text-xs font-medium text-red-700">{restoreError}</p>
        ) : null}
        {restoreSuccess ? (
          <p className="mt-2 text-xs font-medium text-primary">{restoreSuccess}</p>
        ) : null}
        {canRestore ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={restoreBusy}
            disabled={busy}
            onClick={() => void handleRestore()}
          >
            Restore from payout transfer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
