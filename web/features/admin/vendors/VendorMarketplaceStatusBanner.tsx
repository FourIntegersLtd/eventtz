"use client";

import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { getVendorListingOverride, VENDOR_LISTING_OVERRIDE_META } from "@/lib/domain-types";

type Props = {
  vendor: AdminVendorRow;
};

function statusCopy(vendor: AdminVendorRow): {
  label: "Live" | "Hidden" | "Banned";
  labelClass: string;
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
      labelClass: "text-red-700 bg-red-50 ring-red-200/80",
      headline: "Not on the marketplace",
      detail: "Banned vendors cannot appear in explore or use their portal.",
    };
  }
  if (listingVisible) {
    return {
      label: "Live",
      labelClass: "text-emerald-700 bg-emerald-50 ring-emerald-200/80",
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
      labelClass: "text-amber-800 bg-amber-50 ring-amber-200/80",
      headline: "Not visible to clients",
      detail: "Approve this vendor before they can go live.",
    };
  }
  if (override === "hidden") {
    return {
      label: "Hidden",
      labelClass: "text-amber-800 bg-amber-50 ring-amber-200/80",
      headline: "Listing hidden by admin",
      detail: vendor.listing_override_reason ?? "The vendor account stays open.",
    };
  }
  if (!payoutsVerified) {
    return {
      label: "Hidden",
      labelClass: "text-amber-800 bg-amber-50 ring-amber-200/80",
      headline: "Approved, waiting on Stripe",
      detail: vendor.stripe_account_id
        ? "Stripe hasn't verified payouts yet. They go live automatically once it does."
        : "They still need to finish payout setup.",
    };
  }
  return {
    label: "Hidden",
    labelClass: "text-amber-800 bg-amber-50 ring-amber-200/80",
    headline: "Not visible to clients",
    detail: "Check approval and listing settings below.",
  };
}

export function VendorMarketplaceStatusBanner({ vendor }: Props) {
  const { label, labelClass, headline, detail } = statusCopy(vendor);

  return (
    <div className="ez-banner flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{headline}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${labelClass}`}
      >
        {label}
      </span>
    </div>
  );
}
