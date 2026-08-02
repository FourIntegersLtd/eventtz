"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ExternalLink,
  MessageCircle,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { VendorMetricsStrip } from "@/components/vendor/VendorMetricsStrip";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { displayEventTypes, displayServicesOffered } from "./browseLabels";
import { buildBrowseVendorProfileFacts } from "./browseVendorFacts";
import { BrowseProfileFactRow } from "./BrowseProfileFactRow";
import {
  BrowseProfileGoodToKnowCard,
  hasBrowseGoodToKnowContent,
} from "./BrowseProfileGoodToKnowCard";
import {
  buildBookingLineItems,
  buildBrowsePricingOptions,
  extractBrowsePricingSharedContext,
  formatBookingTotalGbp,
  packageSpecificTravelLine,
  portfolioImageUrlsFromPayload,
} from "./vendorBrowseDetailModel";
import { VendorReviewsSection } from "./VendorReviewsSection";
import { BrowsePricingOptionCard } from "@/components/vendor/BrowsePricingOptionCard";
import { BrowsePricingPackagesSection } from "@/components/vendor/BrowsePricingPackagesSection";
import { BrowsePricingSharedInfo } from "@/components/vendor/BrowsePricingSharedInfo";
import { PortfolioImageGallery } from "@/components/ui/PortfolioImageGallery";
import { marketLocationFallback } from "@/lib/markets";

type VendorBrowseDetailBodyProps = {
  vendor: ExploreVendor;
  requireLoginForActions: boolean;
  /** Client sign-in (e.g. returning users). */
  loginHref: string;
  /** New visitors: create a client account before continuing. */
  registerHref: string;
  onContinue: () => void;
  /** Logged-in clients: opens booking with selected package/rate ids. Omit for non-clients - only contact is shown. */
  onRequestBooking?: (selectedOptionIds: string[]) => void;
  /** Logged-in only: opens in-app chat with this vendor (no email). */
  onContactVendor?: () => void;
  /** Where to return after sign-in/register from this screen (defaults to browse index). */
  detailReturnPath?: string;
};

function payloadStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v : "";
}

export function VendorBrowseDetailBody({
  vendor,
  requireLoginForActions,
  loginHref,
  registerHref,
  onContinue,
  onRequestBooking,
  onContactVendor,
  detailReturnPath,
}: VendorBrowseDetailBodyProps) {
  const p = vendor.payload ?? {};
  const businessName =
    payloadStr(p, "businessName").trim() || "Vendor";
  const facts = useMemo(() => buildBrowseVendorProfileFacts(p), [p]);
  const city =
    facts.locationLine ||
    marketLocationFallback(payloadStr(p, "countryCode") || undefined);
  const bio =
    payloadStr(p, "aiBioDraft").trim() ||
    "This vendor has not added a bio yet.";
  const services = Array.isArray(p.servicesOffered)
    ? p.servicesOffered.map((s) => String(s))
    : [];
  const events = Array.isArray(p.eventTypes)
    ? p.eventTypes.map((s) => String(s))
    : [];
  const serviceLabels = displayServicesOffered(services);
  const eventLabels = displayEventTypes(events);
  const hasCoverage =
    facts.howTheyWork.length > 0 ||
    Boolean(facts.travelRadiusLabel) ||
    Boolean(facts.travelFeePolicy) ||
    Boolean(facts.travelCustomNote);
  const hasGoodToKnow = hasBrowseGoodToKnowContent(facts);

  const portfolioUrls = useMemo(
    () => portfolioImageUrlsFromPayload(p),
    [p],
  );

  const pricingOptions = useMemo(
    () => buildBrowsePricingOptions(vendor),
    [vendor],
  );
  const pricingShared = useMemo(
    () => extractBrowsePricingSharedContext(p, pricingOptions),
    [p, pricingOptions],
  );
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);
  const [bookingSelectError, setBookingSelectError] = useState(false);

  const selectedLineItems = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selectedPackageIds]),
    [pricingOptions, selectedPackageIds],
  );
  const selectedTotal = useMemo(
    () => formatBookingTotalGbp(selectedLineItems),
    [selectedLineItems],
  );

  const togglePackage = (id: string) => {
    setSelectedPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBookingSelectError(false);
  };

  const returnPath = detailReturnPath ?? "/client/browse";
  const appendAuthParams = (href: string) => {
    const [path, existingQuery] = href.split("?");
    const params = new URLSearchParams(existingQuery ?? "");
    params.set("next", returnPath);
    params.set("vendor", vendor.user_id);
    return `${path}?${params.toString()}`;
  };
  const buildRegisterLink = () => appendAuthParams(registerHref);
  const buildLoginLink = () => appendAuthParams(loginHref);

  const bookingCard = (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
          Pricing &amp; booking
        </h3>
        {onRequestBooking ? (
          <p className="mt-1 text-[13px] text-neutral-400">
            Select what you need, then request a booking.
          </p>
        ) : null}
      </div>

      <BrowsePricingSharedInfo
        {...pricingShared}
        variant="booking"
        className="border-t border-neutral-100"
      />

      <BrowsePricingPackagesSection
        options={pricingOptions}
        listClassName="max-h-[min(60vh,500px)] overflow-y-auto overscroll-contain"
        getItemClassName={(opt) =>
          `px-4 py-4 transition ${
            selectedPackageIds.has(opt.id) ? "bg-white" : ""
          }`
        }
      >
        {(opt) => {
          const isOpen = detailOpenId === opt.id;
          const showCheckbox = Boolean(onRequestBooking);
          const selected = selectedPackageIds.has(opt.id);
          return (
            <BrowsePricingOptionCard
              opt={opt}
              packageTravelLine={packageSpecificTravelLine(opt, pricingShared)}
              hideFeatureLines={pricingShared.serviceLines.length > 0}
              hidePromoLines={pricingShared.promoLines.length > 0}
              isOpen={isOpen}
              showCheckbox={showCheckbox}
              selected={selected}
              onToggleSelect={() => togglePackage(opt.id)}
              onToggleDetails={() => setDetailOpenId(isOpen ? null : opt.id)}
            />
          );
        }}
      </BrowsePricingPackagesSection>

      {onRequestBooking && selectedPackageIds.size > 0 ? (
        <div className="border-t border-neutral-100 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-neutral-500">Estimated total</p>
            <p className="text-base font-semibold tabular-nums text-neutral-900">
              {selectedTotal.label.replace(/^GBP\s/, "£")}
            </p>
          </div>
          {selectedTotal.hasTbc ? (
            <p className="mt-1 text-[12px] text-neutral-400">
              Includes items that need a custom quote.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
        {requireLoginForActions ? (
          <>
            <p className="text-[13px] leading-snug text-neutral-500">
              <span className="font-medium text-neutral-800">Sign in to contact this vendor.</span>{" "}
              Create a free client account to continue.
            </p>
            <ButtonLink href={buildRegisterLink()} className="w-full">
              Create account
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </ButtonLink>
            <p className="text-center text-xs text-neutral-500">
              Already have an account?{" "}
              <Link
                href={buildLoginLink()}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </>
        ) : onRequestBooking ? (
          <div className="space-y-2.5">
            {bookingSelectError ? (
              <p className="text-[13px] text-amber-800">
                Select at least one package or rate to continue.
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              icon={<CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
              onClick={() => {
                if (selectedPackageIds.size === 0) {
                  setBookingSelectError(true);
                  return;
                }
                onRequestBooking([...selectedPackageIds]);
              }}
            >
              Request booking
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              icon={<MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
              onClick={() => {
                if (onContactVendor) onContactVendor();
                else onContinue();
              }}
            >
              Message vendor
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              if (onContactVendor) {
                onContactVendor();
              } else {
                onContinue();
              }
            }}
          >
            Contact me
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,440px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,440px)]">
      <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0 lg:col-start-1 lg:row-start-1">
        <header className="order-1 min-w-0 space-y-1.5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            {businessName}
          </h1>
          {city ? (
            <p className="text-base text-neutral-600">{city}</p>
          ) : null}
        </header>

        <PortfolioImageGallery
          className="order-2 min-w-0"
          urls={portfolioUrls}
          alt={`${businessName} portfolio`}
          emptyFallback={businessName}
        />

        <section className="order-4 min-w-0 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="space-y-3 px-5 py-5">
            <h3 className="font-heading text-base font-semibold text-neutral-900">
              About
            </h3>
            <VendorMetricsStrip
              metrics={{
                review_average: vendor.review_average,
                review_count: vendor.review_count,
                completed_bookings: vendor.completed_bookings,
                avg_response_seconds: vendor.avg_response_seconds,
              }}
            />
            <p className="text-sm leading-relaxed text-neutral-700">{bio}</p>
            {facts.portfolioVideoUrls.length > 0 ? (
              <div className="flex flex-col gap-2">
                {facts.portfolioVideoUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    {facts.portfolioVideoUrls.length > 1
                      ? `Watch portfolio video ${index + 1}`
                      : "Watch portfolio video"}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-neutral-100 px-5 py-5">
            <h4 className="text-sm font-semibold text-neutral-900">Services &amp; events</h4>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[13px] text-neutral-500">Services</p>
                {serviceLabels.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {serviceLabels.map((label, i) => (
                      <li
                        key={`svc-${i}-${label}`}
                        className="inline-flex rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm italic text-neutral-400">Not specified yet</p>
                )}
              </div>
              <div>
                <p className="text-[13px] text-neutral-500">Event types</p>
                {eventLabels.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {eventLabels.map((label, i) => (
                      <li
                        key={`evt-${i}-${label}`}
                        className="inline-flex rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm italic text-neutral-400">Not specified yet</p>
                )}
              </div>
            </div>
          </div>

          {hasCoverage ? (
            <div className="border-t border-neutral-100">
              <div className="px-5 pt-4 pb-1">
                <h4 className="text-sm font-semibold text-neutral-900">Coverage</h4>
              </div>
              <dl className="space-y-1 px-5 pb-4">
                {facts.howTheyWork.length > 0 ? (
                  <BrowseProfileFactRow
                    label="How they work"
                    value={facts.howTheyWork.join(" · ")}
                  />
                ) : null}
                {facts.travelRadiusLabel ? (
                  <BrowseProfileFactRow
                    label="Travel radius"
                    value={facts.travelRadiusLabel}
                  />
                ) : null}
                {facts.travelFeePolicy ? (
                  <BrowseProfileFactRow
                    label="Travel fees"
                    value={facts.travelFeePolicy}
                    tone={
                      facts.travelFeePolicy.includes("confirmed after you enquire")
                        ? "notice"
                        : "default"
                    }
                  />
                ) : null}
                {facts.travelCustomNote ? (
                  <BrowseProfileFactRow label="Travel note" value={facts.travelCustomNote} tone="notice" />
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
        {bookingCard}
        {hasGoodToKnow ? <BrowseProfileGoodToKnowCard facts={facts} /> : null}
      </aside>
    </div>
  );
}
