"use client";

import Link from "next/link";
import type { ExpandedSearchCard } from "./marketplaceSearchModel";
import { VENDOR_SERVICE_OPTIONS } from "./vendorServiceOptions";
import { listingCoverImageUrlFromPayload } from "./vendorPortfolioImages";
import { formatUsualReplyWithin, formatVendorCompletedBookings, formatVendorRating } from "./vendorMetrics";
import { formatMoney, getMarket, marketLocationFallback } from "./markets";

const REPLY_CHIP_MAX_SECONDS = 48 * 3600;

function labelForService(value: string): string {
  return VENDOR_SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const marketplaceVendorCardGridClass =
  "grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8";

type Props = { card: ExpandedSearchCard; vendorDetailHref?: string; bookmarked?: boolean; onToggleBookmark?: () => void; showBookmark?: boolean };

export function MarketplaceVendorCard({ card, vendorDetailHref, bookmarked = false, onToggleBookmark, showBookmark = true }: Props) {
  const vendor = card.vendor;
  const href = vendorDetailHref ?? `/client/browse/${vendor.user_id}`;
  const payload = (vendor.profile_form_data ?? {}) as Record<string, unknown>;
  const biz = (typeof payload.businessName === "string" && payload.businessName) || "Unnamed business";
  const city = (typeof payload.baseCity === "string" && payload.baseCity) || marketLocationFallback(typeof payload.countryCode === "string" ? payload.countryCode : undefined);
  const svcs = Array.isArray(payload.servicesOffered) ? payload.servicesOffered.map((s: unknown) => String(s)) : [];
  const catValue = card.highlightService ?? svcs[0] ?? null;
  const catLabel = catValue ? labelForService(catValue) : "Vendor";

  const market = getMarket(typeof payload.countryCode === "string" ? payload.countryCode : undefined);
  const prices: number[] = [];
  const addP = (raw: unknown) => { if (typeof raw === "string") { const n = Number.parseFloat(raw); if (Number.isFinite(n) && n > 0) prices.push(n); } };
  addP(payload.hourlyRate);
  addP(payload.dailyRate);
  const pkgList = payload.packages;
  if (Array.isArray(pkgList)) for (const pkg of pkgList) if (pkg && typeof pkg === "object") addP((pkg as { price?: unknown }).price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  const ratingLabel = formatVendorRating(vendor.review_average, vendor.review_count);
  const completedLabel = formatVendorCompletedBookings(vendor.completed_bookings);
  const avg = vendor.avg_response_seconds;
  const replyLabel = avg != null && avg <= REPLY_CHIP_MAX_SECONDS ? formatUsualReplyWithin(avg) : null;
  const coverUrl = listingCoverImageUrlFromPayload(payload);
return (
    <Link href={href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-md">
      {coverUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={biz} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          {showBookmark ? (
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(); }}
              aria-label={bookmarked ? "Remove from saved" : "Save"}
              aria-pressed={bookmarked}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-neutral-600 backdrop-blur-sm transition hover:bg-white hover:text-red-500">
              <span aria-hidden>{bookmarked ? "\u2665" : "\u2661"}</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative aspect-[16/10] w-full bg-primary-soft/60 ring-1 ring-primary-border/40">
          {showBookmark ? (
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark?.(); }}
              aria-label={bookmarked ? "Remove from saved" : "Save"}
              aria-pressed={bookmarked}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-neutral-600 backdrop-blur-sm transition hover:bg-white hover:text-red-500">
              <span aria-hidden>{bookmarked ? "\u2665" : "\u2661"}</span>
            </button>
          ) : null}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <span className="inline-block w-fit rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">{catLabel}</span>
        <h3 className="mt-2 font-heading text-lg font-semibold leadng-snug text-neutral-900 group-hover:text-primry">{biz}</h3>
        <p className="mt-1 text-sm text-neutral-500">{city}</p>
        {(ratingLabel || completedLabel || replyLabel) ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-x text-neutral-500">
            {ratingLabel ? (<span className="inline-flex items-center gap-1"><span aria-hidden="true">\2605</span>{ratingLabel}</span>) : null}
            {completedLabel ? <span>{completedLabel}</span> : null}
            {replyLabel ? <span>Replies within {replyLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="mt-auto border-t border-primry/10 bg-primary-soft px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-lg font-semibold text-primary">
            {minPrice != null ? (<><span className="text-sm font-medium text-primry/65">From </span>{formatMoney(minPrice, market.currency)}</>) : (<span className="text-sm font-medium text-primry/65">View pricing</span>)}
          </p>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-primry/80 uppercase">View profile</span>
        </div>
      </div>
    </Link>
  );
}
