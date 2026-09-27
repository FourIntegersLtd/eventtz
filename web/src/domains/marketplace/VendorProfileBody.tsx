"use client";

/**
 * The vendor profile layout: gallery, about, coverage, reviews, and the pricing sidebar.
 */
import { useMemo } from "react";
import type { ExploreVendorRow } from "./api";
import { displayEventTypes, displayServicesOffered } from "./browseLabels";
import { buildBrowseVendorProfileFacts, payloadStringField } from "./browseVendorFacts";
import { GoodToKnowCard, hasGoodToKnowContent } from "./GoodToKnowCard";
import { marketLocationFallback } from "./markets";
import { ProfileFactRow } from "./ProfileFactRow";
import { publicListingImageUrlsFromPayload } from "./vendorPortfolioImages";
import { buildVendorMetricItems } from "./vendorMetrics";
import { VendorProfileGallery } from "./VendorProfileGallery";
import { VendorProfilePricing } from "./VendorProfilePricing";
import { VendorReviewsSection } from "./VendorReviewsSection";
import type { BookingLineItem, BrowsePricingOption } from "./vendorBrowseDetailModel";

type VendorProfileBodyProps = {
  vendor: ExploreVendorRow;
  pricingOptions: BrowsePricingOption[];
  selectedIds: Set<string>;
  quantities: Record<string, number>;
  lineItems: BookingLineItem[];
  referralDiscountGbp: number;
  onTogglePackage: (id: string) => void;
  onPackageQuantity: (id: string, quantity: number) => void;
  showBookingActions: boolean;
  requireLogin: boolean;
  registerHref: string;
  loginHref: string;
  messageHref: string;
  continueHref: string;
  bookingSelectError: boolean;
  onRequestBooking: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
};

/** Profile content under the breadcrumb. */
export function VendorProfileBody(props: VendorProfileBodyProps) {
  const { vendor } = props;
  const payload = useMemo(() => vendorPayload(vendor), [vendor]);
  const facts = useMemo(() => buildBrowseVendorProfileFacts(payload), [payload]);
  const businessName = payloadStringField(payload, "businessName").trim() || "Vendor";
  const city =
    facts.locationLine || marketLocationFallback(payloadStringField(payload, "countryCode") || undefined);
  const bio = payloadStringField(payload, "aiBioDraft").trim() || "This vendor has not added a bio yet.";
  const serviceLabels = displayServicesOffered(stringList(payload.servicesOffered));
  const eventLabels = displayEventTypes(stringList(payload.eventTypes));
  const portfolioUrls = useMemo(() => publicListingImageUrlsFromPayload(payload), [payload]);
  const metrics = buildVendorMetricItems({
    review_average: vendor.review_average,
    review_count: vendor.review_count,
    completed_bookings: vendor.completed_bookings,
    avg_response_seconds: vendor.avg_response_seconds,
  });
  const hasCoverage =
    facts.howTheyWork.length > 0 ||
    Boolean(facts.travelRadiusLabel) ||
    Boolean(facts.travelFeePolicy) ||
    Boolean(facts.travelCustomNote);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,440px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,440px)]">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6 lg:col-start-1 lg:row-start-1">
        <header className="order-1 hidden min-w-0 space-y-1.5 md:block">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            {businessName}
          </h1>
          {city ? <p className="text-base text-neutral-600">{city}</p> : null}
        </header>

        <div className="order-2 min-w-0">
          <VendorProfileGallery
            urls={portfolioUrls}
            videoUrls={facts.portfolioVideoUrls}
            alt={`${businessName} portfolio`}
            emptyFallback={businessName}
            bookmarked={props.bookmarked}
            onToggleBookmark={props.onToggleBookmark}
          />
        </div>

        <section className="order-4 min-w-0 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="space-y-3 px-5 py-5">
            <h3 className="font-heading text-base font-semibold text-neutral-900">About</h3>
            {metrics.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Vendor stats">
                {metrics.map((item) => (
                  <li key={item.key} className="rounded-xl border border-neutral-100 bg-white px-3.5 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{item.label}</p>
                    <p className="mt-1.5 text-base font-semibold tabular-nums tracking-tight text-neutral-900">
                      {item.value}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-sm leading-relaxed text-neutral-700">{bio}</p>
          </div>

          <div className="border-t border-neutral-100 px-5 py-5">
            <h4 className="text-sm font-semibold text-neutral-900">Services &amp; events</h4>
            <div className="mt-4 space-y-4">
              <ChipList label="Services" items={serviceLabels} />
              <ChipList label="Event types" items={eventLabels} />
            </div>
          </div>

          {hasCoverage ? (
            <div className="border-t border-neutral-100">
              <div className="px-5 pb-1 pt-4">
                <h4 className="text-sm font-semibold text-neutral-900">Coverage</h4>
              </div>
              <dl className="space-y-1 px-5 pb-4">
                {facts.howTheyWork.length > 0 ? (
                  <ProfileFactRow label="How they work" value={facts.howTheyWork.join(" · ")} />
                ) : null}
                {facts.travelRadiusLabel ? (
                  <ProfileFactRow label="Travel radius" value={facts.travelRadiusLabel} />
                ) : null}
                {facts.travelFeePolicy ? (
                  <ProfileFactRow
                    label="Travel fees"
                    value={facts.travelFeePolicy}
                    tone={
                      facts.travelFeePolicy.includes("confirmed after you enquire") ? "notice" : "default"
                    }
                  />
                ) : null}
                {facts.travelCustomNote ? (
                  <ProfileFactRow label="Travel note" value={facts.travelCustomNote} tone="notice" />
                ) : null}
              </dl>
            </div>
          ) : null}
        </section>

        <div className="order-5 min-w-0">
          <VendorReviewsSection vendorUserId={vendor.user_id} />
        </div>
      </div>

      <aside className="order-3 flex flex-col gap-4 lg:sticky lg:top-2 lg:col-start-2 lg:row-start-1 lg:self-start">
        <VendorProfilePricing
          payload={payload}
          options={props.pricingOptions}
          selectedIds={props.selectedIds}
          quantities={props.quantities}
          lineItems={props.lineItems}
          referralDiscountGbp={props.referralDiscountGbp}
          onTogglePackage={props.onTogglePackage}
          onPackageQuantity={props.onPackageQuantity}
          showBookingActions={props.showBookingActions}
          requireLogin={props.requireLogin}
          registerHref={props.registerHref}
          loginHref={props.loginHref}
          messageHref={props.messageHref}
          continueHref={props.continueHref}
          bookingSelectError={props.bookingSelectError}
          onRequestBooking={props.onRequestBooking}
        />
        {hasGoodToKnowContent(facts) ? <GoodToKnowCard facts={facts} /> : null}
      </aside>
    </div>
  );
}

function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[13px] text-neutral-500">{label}</p>
      {items.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${label}-${index}-${item}`}
              className="inline-flex rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm italic text-neutral-400">Not specified yet</p>
      )}
    </div>
  );
}

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((entry) => String(entry)) : [];
}

function vendorPayload(vendor: ExploreVendorRow): Record<string, unknown> {
  const payload = vendor.profile_form_data;
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) return payload;
  return {};
}
