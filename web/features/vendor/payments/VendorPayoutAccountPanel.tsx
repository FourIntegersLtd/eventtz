"use client";

import { LoadingState } from "@/components/ui/LoadingState";
import { VendorPayoutHowItWorksCard } from "@/features/vendor/payments/VendorPayoutHowItWorksCard";
import {
  resolveLivePayoutCardVariant,
  VendorPayoutStateCard,
} from "@/features/vendor/payments/VendorPayoutStateCard";
import type { VendorPaymentsStatus } from "@/lib/vendorPaymentsApi";

type VendorPayoutAccountPanelProps = {
  status: VendorPaymentsStatus | null;
  loading: boolean;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
};

export function VendorPayoutAccountPanel({
  status,
  loading,
  connecting,
  error,
  onConnect,
}: VendorPayoutAccountPanelProps) {
  const liveVariant = resolveLivePayoutCardVariant(status);

  return (
    <div className="ez-stack ez-stack--lg">
      {loading ? (
        <LoadingState label="Loading payout status…" variant="inline" />
      ) : (
        <div className="ez-grid-3">
          <VendorPayoutStateCard variant={liveVariant} connecting={connecting} onConnect={onConnect} />
        </div>
      )}

      <VendorPayoutHowItWorksCard />

      {error ? (
        <div className="ez-banner ez-banner--danger" role="alert">
          <p className="ez-small">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
