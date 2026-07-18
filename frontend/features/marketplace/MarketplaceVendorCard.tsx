"use client";

import { BadgeCheck, Check, Heart, Star } from "lucide-react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { useRouter } from "next/navigation";
import { VendorPortfolioCover } from "@/components/vendor/VendorPortfolioCover";
import { buildBrowsePricingOptions } from "@/features/client/browse/vendorBrowseDetailModel";
import type { ExpandedSearchCard } from "@/features/marketplace/marketplaceSearchModel";
import { SERVICE_OPTIONS } from "@/features/vendor/onboarding/constants";
import { formatMoney, getMarket, marketLocationFallback } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import {
  formatUsualReplyWithin,
  formatVendorCompletedBookings,
} from "@/lib/vendorMetrics";
import { profileImageUrlFromPayload } from "@/lib/vendorPortfolioImages";

/** Conversion rate above which plan cards show “Often booked”. */
const OFTEN_BOOKED_CONVERSION_MIN = 0.35;
/** Hide reply chips when average response is slower than this (noisy / unhelpful). */
const REPLY_CHIP_MAX_SECONDS = 48 * 3600;

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
  /** Multi-enquire: show select control (signed-in clients). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Fires before navigating to the vendor detail page. */
  onNavigate?: (vendorUserId: string) => void;
  /** Plan-mode evidence (quote + trust). */
  showPlanEvidence?: boolean;
};

/**
 * Browse card: cover → vendor → package → evidence → price / add-to-request.
 */
export function MarketplaceVendorCard({
  card,
  vendorDetailHref,
  bookmarked = false,
  onToggleBookmark,
  showBookmark = true,
  selectable = false,
  selected = false,
  onToggleSelect,
  onNavigate,
  showPlanEvidence = false,
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

  const servicesRaw = Array.isArray(p.servicesOffered)
    ? p.servicesOffered.map((s) => String(s))
    : [];
  const categoryValue = card.highlightService ?? servicesRaw[0] ?? null;
  const categoryLabel = categoryValue ? labelForService(categoryValue) : "Vendor";

  const options = buildBrowsePricingOptions(v);
  const pricedOptions = options.filter(
    (o) => o.unitPriceGbp != null && Number.isFinite(o.unitPriceGbp),
  );
  const cheapest = pricedOptions.reduce<(typeof options)[number] | null>(
    (best, o) => {
      if (best == null || (o.unitPriceGbp ?? Infinity) < (best.unitPriceGbp ?? Infinity)) {
        return o;
      }
      return best;
    },
    null,
  );
  const market = getMarket(typeof p.countryCode === "string" ? p.countryCode : undefined);
  const minGbp = cheapest?.unitPriceGbp ?? null;
  const priceLabel =
    minGbp != null ? formatMoney(minGbp, market.currency) : "Quote";
  const packageTitle =
    cheapest?.heading?.trim() ||
    (categoryLabel !== "Vendor" ? `${categoryLabel} package` : "Custom package");

  const travelKey = typeof p.travelRadius === "string" ? p.travelRadius : "";
  const travelLabel =
    radiusOptionsForMarket(market).find((o) => o.value === travelKey)?.label ?? null;
  const travelMeta = travelLabel
    ? travelLabel.toLowerCase().startsWith("under")
      ? `Travels ${travelLabel.toLowerCase()}`
      : `Travels ${travelLabel}`
    : null;

  const completed = Number(v.completed_bookings) || 0;
  const avgReplySeconds =
    v.avg_response_seconds != null ? Number(v.avg_response_seconds) : NaN;
  const replyWithin =
    Number.isFinite(avgReplySeconds) && avgReplySeconds <= REPLY_CHIP_MAX_SECONDS
      ? formatUsualReplyWithin(avgReplySeconds)
      : null;
  const conversion = Number(v.conversion_rate);
  const oftenBooked =
    showPlanEvidence &&
    Number.isFinite(conversion) &&
    conversion >= OFTEN_BOOKED_CONVERSION_MIN;
  const completedLabel = completed > 0 ? formatVendorCompletedBookings(completed) : null;
  const replyLabel = replyWithin ? `Replies in ${replyWithin}` : null;

  const avatarUrl = profileImageUrlFromPayload(p);
  const rc = v.review_count ?? 0;
  const ra = v.review_average;
  const showRating = rc > 0 && ra != null;
  const featured = showPlanEvidence ? v.featured_review : null;
  const featuredRating = featured?.rating != null ? Number(featured.rating) : 0;
  const trustLine = [oftenBooked ? "Often booked" : null, completedLabel, replyLabel]
    .filter(Boolean)
    .join(" · ");

  const openDetail = () => {
    onNavigate?.(v.user_id);
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
      className={`group relative isolate mx-auto flex w-full max-w-[22rem] cursor-pointer flex-col overflow-hidden ${portalCard} text-left transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${selected ? "border-primary ring-2 ring-primary/35" : ""}`}
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
            className="pointer-events-none h-4 w-4"
            strokeWidth={2}
            fill={bookmarked ? "currentColor" : "none"}
          />
        </button>
      ) : null}

      <VendorPortfolioCover
        payload={p}
        businessName={biz}
        heightClass="h-44 sm:h-48"
        objectFit="cover"
        className="rounded-none"
        overlay={
          <div className="flex flex-wrap items-start gap-2">
            <p className="inline-flex rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-neutral-900 shadow-sm ring-1 ring-black/5">
              {categoryLabel}
            </p>
          </div>
        }
      />

      <div className="flex flex-1 flex-col bg-[#faf8fc] px-3.5 pb-0 pt-3.5">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-2 ring-white shadow-sm">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary">
                {biz.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 text-sm font-semibold text-neutral-900">
              <span className="truncate">{biz}</span>
              <BadgeCheck
                className="h-4 w-4 shrink-0 text-primary"
                strokeWidth={2}
                aria-label="Verified vendor"
              />
            </p>
            <p className="truncate text-xs text-neutral-500">
              {[city, travelMeta].filter(Boolean).join(" · ")}
            </p>
          </div>
          {showRating ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/15 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {ra.toFixed(1)}
              <span className="font-medium text-primary/70">({rc})</span>
            </span>
          ) : null}
        </div>

        <h4 className="font-heading mt-3 line-clamp-2 text-lg font-semibold leading-snug text-neutral-900 group-hover:text-primary">
          {packageTitle}
        </h4>

        {!showPlanEvidence && (completedLabel || replyLabel) ? (
          <p className="mt-1.5 truncate text-xs text-neutral-500">
            {[completedLabel, replyLabel].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {showPlanEvidence && trustLine ? (
          <p className="mt-1.5 text-xs font-medium text-neutral-600">{trustLine}</p>
        ) : null}

        {showPlanEvidence && featured?.body_excerpt ? (
          <figure className="mt-2.5">
            {featuredRating >= 1 ? (
              <div
                className="mb-1 flex items-center gap-0.5 text-primary"
                aria-label={`${featuredRating} out of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < featuredRating ? "fill-current" : "text-neutral-200"}`}
                    aria-hidden
                  />
                ))}
              </div>
            ) : null}
            <blockquote className="text-sm leading-snug text-neutral-700">
              <span className="line-clamp-3">“{featured.body_excerpt}”</span>
            </blockquote>
            {featured.reviewer_display ? (
              <figcaption className="mt-1 text-xs font-medium text-neutral-500">
                — {featured.reviewer_display}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>

      <div className="mt-3.5 space-y-2 border-t border-primary/10 bg-primary-soft px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-lg font-semibold text-primary">
            {minGbp != null ? (
              <>
                <span className="text-sm font-medium text-primary/65">From </span>
                {priceLabel}
              </>
            ) : (
              priceLabel
            )}
          </p>
          {!selectable ? (
            <span className="text-[11px] font-semibold tracking-[0.12em] text-primary/80 uppercase">
              View profile
            </span>
          ) : null}
        </div>

        {selectable ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              selected
                ? "bg-primary text-white shadow-sm"
                : "border border-primary/30 bg-white text-primary hover:border-primary hover:bg-white"
            }`}
            aria-pressed={selected}
          >
            {selected ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Added — message together
              </>
            ) : (
              "Add to message"
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
