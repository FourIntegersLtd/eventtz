"use client";

import { BackLink } from "@/components/ui/BackLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";
import { NeedsAttentionBanner } from "./AdminBookingDetailShared";

type Props = {
  eventName: string;
  status: string;
  paymentStatus: string;
  holdActive: boolean;
  support: AdminBookingSupportMeta | null;
  openDispute: AdminBookingSupportMeta["open_dispute"] | null | undefined;
};

export function AdminBookingDetailHeader({
  eventName,
  status,
  paymentStatus,
  holdActive,
  support,
  openDispute,
}: Props) {
  return (
    <>
      <BackLink href="/admin/commerce?tab=bookings" label="Bookings" icon="chevron" tone="muted" />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{eventName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <PaymentStatusBadge status={paymentStatus} />
        </div>
        {(holdActive || support?.vendor_stripe_payouts_enabled === false) && (
          <p className="mt-2 text-xs text-neutral-500">
            {holdActive ? "Payout paused for this booking." : null}
            {holdActive && support?.vendor_stripe_payouts_enabled === false ? " · " : null}
            {support?.vendor_stripe_payouts_enabled === false
              ? "Vendor hasn't finished payout setup."
              : null}
          </p>
        )}
      </header>

      {support && support.needs_attention.length > 0 ? (
        <NeedsAttentionBanner support={support} openDispute={openDispute ?? null} />
      ) : null}
    </>
  );
}
