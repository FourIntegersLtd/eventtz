"use client";

import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import type { Tone } from "@/lib/tone";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { getVendorListingOverride, VENDOR_LISTING_OVERRIDE_META } from "@/lib/domain-types";

type Props = {
  vendor: AdminVendorRow;
};

function statusCopy(vendor: AdminVendorRow): {
  label: "Live" | "Hidden" | "Banned";
  tone: Tone;
  headline: string;
  detail: string;
} {
  const approved = vendor.approval_status === "approved";
  const banned = vendor.approval_status === "banned";
  const listingVisible = Boolean(vendor.listing_visible);
  const payoutsVerified = Boolean(vendor.payouts_verified);
  const override = getVendorListingOverride(vendor.listing_override);
  const overrideLabel = VENDOR_LISTING_OVERRIDE_META[override].label;

  if (banned) {
    return {
      label: "Banned",
      tone: "danger",
      headline: "Not on the marketplace",
      detail: "Banned vendors cannot appear in explore or use their portal.",
    };
  }
  if (listingVisible) {
    return {
      label: "Live",
      tone: "success",
      headline: "Clients can find and book this vendor",
      detail:
        override === "visible"
          ? `Published with admin override (${overrideLabel}).`
          : payoutsVerified
            ? "Approved and Stripe payouts verified."
            : "Visible on explore.",
    };
  }
  if (!approved) {
    return {
      label: "Hidden",
      tone: "warning",
      headline: "Not visible to clients",
      detail: "Approve this vendor before they can go live.",
    };
  }
  if (override === "hidden") {
    return {
      label: "Hidden",
      tone: "warning",
      headline: "Listing hidden by admin",
      detail: vendor.listing_override_reason ?? "The vendor account stays open.",
    };
  }
  if (!payoutsVerified) {
    return {
      label: "Hidden",
      tone: "warning",
      headline: "Approved, waiting on Stripe",
      detail: vendor.stripe_account_id
        ? "Stripe hasn't verified payouts yet. They go live automatically once it does."
        : "They still need to finish payout setup.",
    };
  }
  return {
    label: "Hidden",
    tone: "warning",
    headline: "Not visible to clients",
    detail: "Check approval and listing settings below.",
  };
}

export function VendorMarketplaceStatusBanner({ vendor }: Props) {
  const { label, tone, headline, detail } = statusCopy(vendor);

  return (
    <Banner plain action={<Badge tone={tone}>{label}</Badge>}>
      <p className="font-medium text-ink">{headline}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{detail}</p>
    </Banner>
  );
}
