"use client";

import {
  BadgeCheck,
  Briefcase,
  Check,
  Clock,
  Globe,
  Heart,
  MapPin,
  Star,
} from "lucide-react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { useRouter } from "next/navigation";
import { VendorPortfolioCover } from "@/components/vendor/VendorPortfolioCover";
import { VendorMetricsStrip } from "@/components/vendor/VendorMetricsStrip";
import { buildBrowsePricingOptions } from "@/features/client/browse/vendorBrowseDetailModel";
import type { ExpandedSearchCard } from "@/features/marketplace/marketplaceSearchModel";
import {
  EVENT_TYPE_OPTIONS,
  SERVICE_OPTIONS,
} from "@/features/vendor/onboarding/constants";
import { formatMoney, getMarket, marketLocationFallback } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { profileImageUrlFromPayload } from "@/lib/vendorPortfolioImages";

function labelForService(value: string): string {
  return SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function labelForEventType(value: string): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

type MarketplaceVendorCardProps = {
  card: ExpandedSearchCard;
  /** Defaults to `/client/browse/{id}` when omitted. */
  vendorDetailHref?: string;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  showBookmark?: boolean;
  /** Multi-enquire: show select checkbox (signed-in clients). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

function DetailChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-2.5 py-2 text-xs font-medium text-neutral-700 shadow-sm">
      <span className="shrink-0 text-primary/70">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

export function MarketplaceVendorCard({
  card,
  vendorDetailHref,
  bookmarked = false,
  onToggleBookmark,
  showBookmark = true,
  selectable = false,
  selected = false,
  onToggleSelect,
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
    radiusOptionsForMarket(market).find((o) => o.value === travelKey)?.label ??
    null;
  const travelChip = travelLabel
    ? travelLabel.toLowerCase().startsWith("under")
      ? `Travels ${travelLabel.toLowerCase()}`
      : `Travels ${travelLabel}`
    : "Local & travel";

  const durationChip =
    cheapest?.timelineLine?.trim() ||
    (cheapest?.id.startsWith("rate-hourly")
      ? "Hourly"
      : cheapest?.id.startsWith("rate-daily")
        ? "Daily"
        : "Flexible timing");

  const eventTypesRaw = Array.isArray(p.eventTypes)
    ? p.eventTypes.map((s) => String(s)).filter(Boolean)
    : [];
  const eventChip =
    eventTypesRaw.length === 0
      ? categoryLabel
      : eventTypesRaw.includes("all")
        ? "All events"
        : labelForEventType(eventTypesRaw[0]!);

  const avatarUrl = profileImageUrlFromPayload(p);
  const rc = v.review_count ?? 0;
  const ra = v.review_average;
  const showRating = rc > 0 && ra != null;

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
      className={`group relative isolate mx-auto flex w-full max-w-[22rem] cursor-pointer flex-col overflow-hidden ${portalCard} text-left transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${selected ? "ring-2 ring-primary/40 border-primary/30" : ""}`}
    >
      {selectable ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`absolute left-3 top-3 z-20 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border shadow-sm transition ${
            selected
              ? "border-primary bg-primary text-white"
              : "border-neutral-200 bg-white/95 text-neutral-600 hover:border-primary hover:text-primary"
          }`}
          aria-label={selected ? "Deselect vendor" : "Select vendor"}
          aria-pressed={selected}
        >
          {selected ? (
            <Check className="pointer-events-none h-4 w-4" strokeWidth={2.5} />
          ) : (
            <span
              className="pointer-events-none h-4 w-4 rounded-sm border-2 border-current"
              aria-hidden
            />
          )}
        </button>
      ) : null}
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
            <p className="truncate text-xs text-neutral-500">{categoryLabel}</p>
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

        <VendorMetricsStrip
          className="mt-2"
          variant="compact"
          includeRating={false}
          metrics={{
            completed_bookings: v.completed_bookings,
            avg_response_seconds: v.avg_response_seconds,
            conversion_rate: v.conversion_rate,
          }}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <DetailChip icon={<MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />} label={city} />
          <DetailChip
            icon={<Globe className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label={travelChip}
          />
          <DetailChip
            icon={<Briefcase className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label={eventChip}
          />
          <DetailChip
            icon={<Clock className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label={durationChip}
          />
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-primary/10 bg-primary-soft px-4 py-3.5">
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
        <span className="text-[11px] font-semibold tracking-[0.12em] text-primary/80 uppercase">
          View profile
        </span>
      </div>
    </div>
  );
}
