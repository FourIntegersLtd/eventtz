"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { VendorMetricsStrip } from "@/features/vendors/display/VendorMetricsStrip";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { displayEventTypes, displayServicesOffered } from "../../../lib/vendorBrowseLabels";
import { buildBrowseVendorProfileFacts } from "./browseVendorFacts";
import { DescriptionRow } from "@/components/ui/DescriptionList";
import {
  BrowseProfileGoodToKnowCard,
  hasBrowseGoodToKnowContent,
} from "./BrowseProfileGoodToKnowCard";
import {
  buildBrowsePricingOptions,
  extractBrowsePricingSharedContext,
  formatBookingTotalGbp,
  packageSpecificTravelLine,
} from "../../../lib/vendorBrowseDetailModel";
import { usePerUnitPackageSelection } from "./usePerUnitPackageSelection";
import { VendorReviewsSection } from "./VendorReviewsSection";
import { BrowsePricingOptionCard } from "@/features/vendors/display/BrowsePricingOptionCard";
import { BrowsePricingPackagesSection } from "@/features/vendors/display/BrowsePricingPackagesSection";
import { BrowsePricingSharedInfo } from "@/features/vendors/display/BrowsePricingSharedInfo";
import { PortfolioImageGallery } from "@/features/vendors/display/PortfolioImageGallery";
import { PortfolioVideoStrip } from "@/features/vendors/display/PortfolioVideoStrip";
import { computeClientFeeBreakdown } from "@/lib/bookingServiceFee";
import { ClientFeeBreakdownSummary } from "@/features/bookings/ClientFeeBreakdownSummary";
import { useVendorReferralPreview } from "./useVendorReferralPreview";
import { marketLocationFallback } from "@/lib/markets";
import { payloadStringField } from "@/lib/vendorPayload";
import { serviceFeeBadgeLabel } from "@/features/bookings/bookingTerms";
import { publicListingImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";

type VendorBrowseDetailBodyProps = {
  vendor: ExploreVendor;
  requireLoginForActions: boolean;
  /** Client sign-in (e.g. returning users). */
  loginHref: string;
  /** New visitors: create a client account before continuing. */
  registerHref: string;
  onContinue: () => void;
  /** Logged-in clients: opens booking with selected package/rate ids. Omit for non-clients - only contact is shown. */
  onRequestBooking?: (
    selectedOptionIds: string[],
    quantities: Record<string, number>,
  ) => void;
  /** Logged-in only: opens in-app chat with this vendor (no email). */
  onContactVendor?: () => void;
  /** Where to return after sign-in/register from this screen (defaults to browse index). */
  detailReturnPath?: string;
  /** Stored referral code from ?vref= (logged-in browse). */
  storedReferralCode?: string | null;
};

export function VendorBrowseDetailBody({
  vendor,
  requireLoginForActions,
  loginHref,
  registerHref,
  onContinue,
  onRequestBooking,
  onContactVendor,
  detailReturnPath,
  storedReferralCode,
}: VendorBrowseDetailBodyProps) {
  const p = vendor.profile_form_data ?? {};
  const businessName =
    payloadStringField(p, "businessName").trim() || "Vendor";
  const facts = useMemo(() => buildBrowseVendorProfileFacts(p), [p]);
  const city =
    facts.locationLine ||
    marketLocationFallback(payloadStringField(p, "countryCode") || undefined);
  const bio =
    payloadStringField(p, "aiBioDraft").trim() ||
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
    () => publicListingImageUrlsFromPayload(p),
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
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);
  const [bookingSelectError, setBookingSelectError] = useState(false);

  const {
    selectedIds: selectedPackageIds,
    quantities,
    togglePackage,
    setPackageQuantity,
    lineItems: selectedLineItems,
  } = usePerUnitPackageSelection({
    pricingOptions,
    onSelectionChange: () => setBookingSelectError(false),
  });

  const selectedTotal = useMemo(
    () => formatBookingTotalGbp(selectedLineItems),
    [selectedLineItems],
  );
  const { referralDiscountGbp } = useVendorReferralPreview({
    vendorUserId: vendor.user_id,
    vendorPortionGbp: selectedTotal.sumNumeric,
    initialCode: storedReferralCode,
  });
  const selectedFeeBreakdown = useMemo(() => {
    if (selectedTotal.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: selectedTotal.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [selectedTotal.hasTbc, selectedTotal.sumNumeric, referralDiscountGbp]);

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
    <Card className="min-w-0 overflow-hidden">
      <p className="px-5 pt-4 text-xs font-medium text-ink-3">
        Prices shown are the vendor&apos;s own. {serviceFeeBadgeLabel()} is added at checkout.
      </p>
      <BrowsePricingSharedInfo
        {...pricingShared}
        variant="booking"
        embedded
        className="pt-5"
      />

      <BrowsePricingPackagesSection
        nested
        options={pricingOptions}
        listClassName="max-h-[min(60vh,500px)] overflow-y-auto overscroll-contain [overflow-anchor:none]"
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
              quantity={quantities[opt.id] ?? 0}
              onQuantityChange={
                showCheckbox && opt.pricingMode === "per_unit"
                  ? (qty) => setPackageQuantity(opt.id, qty)
                  : undefined
              }
              onToggleDetails={() => setDetailOpenId(isOpen ? null : opt.id)}
            />
          );
        }}
      </BrowsePricingPackagesSection>

      {onRequestBooking && selectedPackageIds.size > 0 ? (
        <div className="border-t border-line px-5 py-4">
          {selectedFeeBreakdown ? (
            <ClientFeeBreakdownSummary breakdown={selectedFeeBreakdown} compact />
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-ink-3">Estimated total</p>
              <p className="text-base font-semibold tabular-nums text-ink">
                {selectedTotal.label.replace(/^GBP\s/, "£")}
              </p>
            </div>
          )}
          {selectedTotal.hasTbc ? (
            <p className="mt-1 text-[12px] text-ink-3">
              Includes items that need a custom quote.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-line px-5 py-4">
        {requireLoginForActions ? (
          <>
            <p className="text-[13px] leading-snug text-ink-3">
              Create a free client account to continue.
            </p>
            <ButtonLink href={buildRegisterLink()} className="w-full">
              Create account
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </ButtonLink>
            <p className="text-center text-xs text-ink-3">
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
              <p className="text-[13px] text-warning">
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
                onRequestBooking([...selectedPackageIds], quantities);
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
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,440px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,440px)]">
      <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0 lg:col-start-1 lg:row-start-1">
        <header className="order-1 hidden min-w-0 space-y-1.5 md:block">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {businessName}
          </h1>
          {city ? (
            <p className="text-base text-ink-2">{city}</p>
          ) : null}
        </header>

        <div className="order-2 flex min-w-0 flex-col gap-1 md:gap-6">
          <PortfolioImageGallery
            className="min-w-0"
            urls={portfolioUrls}
            alt={`${businessName} portfolio`}
            emptyFallback={businessName}
            layout="collage"
          />

          {facts.portfolioVideoUrls.length > 0 ? (
            <PortfolioVideoStrip
              compact
              className="min-w-0 max-md:-mx-4 max-md:w-[calc(100%+2rem)]"
              videos={facts.portfolioVideoUrls.map((src) => ({ src }))}
            />
          ) : null}
        </div>

        <Card as="section" className="order-4 min-w-0 overflow-hidden">
          <div className="space-y-3 px-5 py-5">
            <h3 className="font-heading text-base font-semibold text-ink">
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
            <p className="text-sm leading-relaxed text-ink-2">{bio}</p>
          </div>

          <div className="border-t border-line px-5 py-5">
            <h4 className="text-sm font-semibold text-ink">Services &amp; events</h4>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[13px] text-ink-3">Services</p>
                {serviceLabels.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {serviceLabels.map((label, i) => (
                      <li key={`svc-${i}-${label}`}>
                        <Badge>{label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm italic text-ink-3">Not specified yet</p>
                )}
              </div>
              <div>
                <p className="text-[13px] text-ink-3">Event types</p>
                {eventLabels.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {eventLabels.map((label, i) => (
                      <li key={`evt-${i}-${label}`}>
                        <Badge>{label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm italic text-ink-3">Not specified yet</p>
                )}
              </div>
            </div>
          </div>

          {hasCoverage ? (
            <div className="border-t border-line">
              <div className="px-5 pt-4 pb-1">
                <h4 className="text-sm font-semibold text-ink">Coverage</h4>
              </div>
              <dl className="space-y-1 px-5 pb-4">
                {facts.howTheyWork.length > 0 ? (
                  <DescriptionRow layout="fact"
                    label="How they work"
                    value={facts.howTheyWork.join(" · ")}
                  />
                ) : null}
                {facts.travelRadiusLabel ? (
                  <DescriptionRow layout="fact"
                    label="Travel radius"
                    value={facts.travelRadiusLabel}
                  />
                ) : null}
                {facts.travelFeePolicy ? (
                  <DescriptionRow layout="fact"
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
                  <DescriptionRow layout="fact" label="Travel note" value={facts.travelCustomNote} tone="notice" />
                ) : null}
              </dl>
            </div>
          ) : null}
        </Card>

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
