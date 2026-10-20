"use client";

import Link from "next/link";
import { BackLink } from "@/components/ui/BackLink";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import type { AdminBookingSupportMeta } from "@/lib/adminPlatformApi";
import { adminBookingRef } from "./adminBookingRef";
import { NeedsAttentionBanner } from "./AdminBookingDetailShared";

type Props = {
  bookingId: string;
  eventName: string;
  createdAt: unknown;
  status: string;
  paymentStatus: string;
  holdActive: boolean;
  support: AdminBookingSupportMeta | null;
  openDispute: AdminBookingSupportMeta["open_dispute"] | null | undefined;
};

function createdCaption(createdAt: unknown, eventName: string): string {
  const parts: string[] = [];
  if (eventName.trim()) parts.push(eventName.trim());
  if (createdAt != null) {
    const date = new Date(String(createdAt));
    if (!Number.isNaN(date.getTime())) {
      parts.unshift(
        `created ${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`,
      );
    }
  }
  return parts.join(" · ");
}

export function AdminBookingDetailHeader({
  bookingId,
  eventName,
  createdAt,
  status,
  paymentStatus,
  holdActive,
  support,
  openDispute,
}: Props) {
  const refLabel = adminBookingRef(bookingId);

  return (
    <>
      <BackLink href="/admin/commerce?tab=bookings" label="Bookings" icon="chevron" tone="muted" />

      <div className="ez-pagehead">
        <div className="ez-pagehead__text">
          <h1 className="ez-h1">Booking {refLabel}</h1>
          <p className="ez-small">{createdCaption(createdAt, eventName)}</p>
        </div>
        <div className="ez-pagehead__actions">
          <StatusBadge status={status} />
          <PaymentStatusBadge status={paymentStatus} />
        </div>
      </div>

      {(holdActive || support?.vendor_stripe_payouts_enabled === false) && (
        <p className="ez-small">
          {holdActive ? "Payout paused for this booking." : null}
          {holdActive && support?.vendor_stripe_payouts_enabled === false ? " · " : null}
          {support?.vendor_stripe_payouts_enabled === false
            ? "Vendor has not finished payout setup."
            : null}
        </p>
      )}

      {support && support.needs_attention.length > 0 ? (
        <NeedsAttentionBanner support={support} openDispute={openDispute ?? null} />
      ) : null}
    </>
  );
}
