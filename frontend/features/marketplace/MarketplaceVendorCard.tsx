"use client";

import { Heart } from "lucide-react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { useRouter } from "next/navigation";
import { displayServicesOffered } from "@/features/client/browse/browseLabels";
import { StarRating } from "@/components/ui/StarRating";
import { VendorPortfolioCover } from "@/components/vendor/VendorPortfolioCover";
import { buildBrowsePricingOptions } from "@/features/client/browse/vendorBrowseDetailModel";
import type { ExpandedSearchCard } from "@/features/marketplace/marketplaceSearchModel";
import { SERVICE_OPTIONS } from "@/components/vendor-onboarding/constants";
import { formatMoney, getMarket, marketLocationFallback } from "@/lib/markets";

function labelForService(value: string): string {
  return SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

type MarketplaceVendorCardProps = {
  card: ExpandedSearchCard;
  /** Defaults to `/client/browse/{id}` when omitted. */
  vendorDetailHref?: string;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  showBookmark?: boolean;
};

export function MarketplaceVendorCard({
  card,
  vendorDetailHref,
  bookmarked = false,
  onToggleBookmark,
  showBookmark = true,
}: MarketplaceVendorCardProps) {
  const router = useRouter();
  const v = card.vendor;
  const detailHref = vendorDetailHref ?? `/client/browse/${v.user_id}`;
  const p = v.payload ?? {};
  const biz =
    (typeof p.businessName === "string" && p.businessName) || "Unnamed business";
  const city =
    (typeof p.baseCity === "string" && p.baseCity) ||
    marketLocationFallback(
      typeof p.countryCode === "string" ? p.countryCode : undefined,
    );
  const bio =
    (typeof p.aiBioDraft === "string" && p.aiBioDraft.trim()) ||
    (typeof p.travelDeliveryPolicy === "string" && p.travelDeliveryPolicy.trim()) ||
    "Professional vendor available for your next event.";
  const servicesRaw = Array.isArray(p.servicesOffered)
    ? p.servicesOffered.map((s) => String(s))
    : [];

  const options = buildBrowsePricingOptions(v);
  const priced = options
    .map((o) => o.unitPriceGbp)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const minGbp = priced.length > 0 ? Math.min(...priced) : null;
  const market = getMarket(typeof p.countryCode === "string" ? p.countryCode : undefined);
  const priceLabel =
    minGbp != null ? `From ${formatMoney(minGbp, market.currency)}` : "Request a quote";

  const highlight = card.highlightService
    ? labelForService(card.highlightService)
    : null;

  const rc = v.review_count ?? 0;
  const ra = v.review_average;

  const openDetail = () => {
    router.push(detailHref);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      className={`group relative isolate cursor-pointer ${portalCard} text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
    >
      {showBookmark ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark?.();
          }}
          className="absolute right-3 top-3 z-20 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-600 shadow-sm transition hover:border-primary hover:text-primary"
          aria-label={bookmarked ? "Remove saved vendor" : "Save vendor"}
        >
          <Heart
            className="h-4 w-4 pointer-events-none"
            strokeWidth={2}
            fill={bookmarked ? "currentColor" : "none"}
          />
        </button>
      ) : null}
      <div className="block p-3">
        <VendorPortfolioCover
          payload={p}
          businessName={biz}
          overlay={
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex rounded-full border border-primary/20 bg-white/95 px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
                {city}
              </p>
              {highlight ? (
                <p className="inline-flex rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-xs font-medium text-amber-900 shadow-sm">
                  {highlight}
                </p>
              ) : null}
            </div>
          }
        />
        <h4 className="font-heading mt-3 text-base font-semibold text-neutral-900 group-hover:text-primary">
          {biz}
        </h4>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
          {rc > 0 && ra != null ? (
            <>
              <StarRating rating={Math.round(ra)} size="sm" />
              <span>
                {ra.toFixed(1)} ({rc} review{rc === 1 ? "" : "s"})
              </span>
            </>
          ) : null}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{bio}</p>
        <p className="mt-3 text-sm font-medium text-neutral-900">{priceLabel}</p>
        {servicesRaw.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {displayServicesOffered(servicesRaw).slice(0, 4).map((svc) => (
              <span
                key={svc}
                className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
              >
                {labelForService(svc)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
