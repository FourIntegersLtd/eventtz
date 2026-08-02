"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  MessageCircle,
  Play,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";
import { VendorMetricsStrip } from "@/components/vendor/VendorMetricsStrip";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { usualReplyExpectation } from "@/lib/vendorMetrics";
import { displayEventTypes, displayServicesOffered } from "./browseLabels";
import { buildBrowseVendorProfileFacts } from "./browseVendorFacts";
import {
  buildBookingLineItems,
  buildBrowsePricingOptions,
  formatBookingTotalGbp,
  portfolioImageUrlsFromPayload,
} from "./vendorBrowseDetailModel";
import { VendorReviewsSection } from "./VendorReviewsSection";
import { PortfolioLightbox } from "./PortfolioLightbox";
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

function BrowsePricingOptionCard({
  opt,
  isOpen,
  showCheckbox,
  selected,
  onToggleSelect,
  onToggleDetails,
}: {
  opt: BrowsePricingOption;
  isOpen: boolean;
  showCheckbox: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleDetails: () => void;
}) {
  const description = opt.description?.trim() ?? "";
  const hasDetails = Boolean(description) || opt.featureLines.length > 0;
  const showLogistics = Boolean(opt.timelineLine || opt.travelLine);

  return (
    <div className="flex gap-3">
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary focus:ring-primary/30"
          aria-label={`Include ${opt.heading}`}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-900">{opt.heading}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {opt.priceDisplay != null ? (
              <>
                {opt.compareAtDisplay ? (
                  <span className="mr-1.5 text-xs font-normal text-neutral-400 line-through">
                    £{opt.compareAtDisplay}
                  </span>
                ) : null}
                £{opt.priceDisplay}
              </>
            ) : (
              <span className="font-medium text-neutral-500">Quote</span>
            )}
          </p>
        </div>

        {opt.discountBadge ? (
          <p>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
              {opt.discountBadge}
            </span>
          </p>
        ) : null}

        {showLogistics ? (
          <div className="rounded-lg bg-neutral-50 px-3 py-2.5 ring-1 ring-inset ring-neutral-100">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Logistics
            </p>
            <dl className="mt-1.5 space-y-1.5">
              {opt.timelineLine ? (
                <div className="flex items-start gap-2 text-[13px] leading-snug text-neutral-700">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <dd>{opt.timelineLine}</dd>
                </div>
              ) : null}
              {opt.travelLine ? (
                <div className="flex items-start gap-2 text-[13px] leading-snug text-neutral-700">
                  <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <dd>{opt.travelLine}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {opt.promoLines.length > 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              Extra savings
            </p>
            <ul className="mt-1.5 space-y-1">
              {opt.promoLines.map((line) => (
                <li key={line} className="text-[12px] leading-snug text-neutral-600">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasDetails ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50/80">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={onToggleDetails}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-neutral-800 transition hover:bg-neutral-100/60"
            >
              <span>What&apos;s included</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-neutral-400 transition ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {isOpen ? (
              <div className="space-y-2.5 border-t border-neutral-200/80 px-3 py-3">
                {description ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                      Package details
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-700">
                      {description}
                    </p>
                  </div>
                ) : null}
                {opt.featureLines.length > 0 ? (
                  <div className={description ? "border-t border-neutral-200/80 pt-2.5" : ""}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                      Services covered
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {opt.featureLines.map((line) => (
                        <li
                          key={line}
                          className="flex items-start gap-2 text-[13px] leading-snug text-neutral-700"
                        >
                          <Check
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
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
  const hasGoodToKnow =
    Boolean(facts.availableDays) ||
    Boolean(facts.unavailableDatesLabel) ||
    facts.foodNotes.length > 0 ||
    facts.trustBadges.length > 0;

  const portfolioUrls = useMemo(
    () => portfolioImageUrlsFromPayload(p),
    [p],
  );
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setActivePhotoIndex(0);
    setLightboxOpen(false);
  }, [vendor.user_id, portfolioUrls.length]);

  const activePhotoUrl =
    portfolioUrls.length > 0
      ? portfolioUrls[Math.min(activePhotoIndex, portfolioUrls.length - 1)]
      : null;

  const pricingOptions = useMemo(
    () => buildBrowsePricingOptions(vendor),
    [vendor],
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,440px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,440px)]">
      <div className="min-w-0 space-y-6">
        <header className="space-y-1.5">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            {businessName}
          </h1>
          {city ? (
            <p className="text-base text-neutral-600">{city}</p>
          ) : null}
        </header>

        <div className="rounded-2xl border border-neutral-100 bg-white">
          <div className="relative flex min-h-[12rem] max-h-[min(90vw,560px)] w-full items-center justify-center overflow-hidden rounded-t-2xl bg-neutral-100 sm:min-h-[16rem] lg:max-h-[620px]">
            {activePhotoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group flex w-full cursor-zoom-in items-center justify-center px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset sm:px-3 sm:py-4"
                aria-label={`Open ${businessName} portfolio fullscreen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePhotoUrl}
                  alt={`${businessName} portfolio`}
                  className="max-h-[min(90vw,560px)] max-w-full object-contain object-center transition duration-300 group-hover:scale-[1.01] lg:max-h-[620px]"
                  decoding="async"
                />
              </button>
            ) : (
              <div className="flex min-h-[12rem] w-full items-center justify-center bg-gradient-to-br from-neutral-100 via-white to-neutral-50 sm:min-h-[16rem]">
                <span className="font-heading text-4xl font-semibold tracking-tight text-neutral-300 sm:text-5xl">
                  {businessName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {portfolioUrls.length > 0 ? (
            <div className="flex shrink-0 gap-2.5 overflow-x-auto border-t border-neutral-100 px-3 py-3.5">
              {portfolioUrls.map((url, index) => {
                const selected = index === activePhotoIndex;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActivePhotoIndex(index)}
                    className={`flex h-[4.5rem] w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 ring-2 transition ${
                      selected
                        ? "ring-neutral-400"
                        : "ring-transparent hover:ring-neutral-300"
                    }`}
                    aria-label={`View portfolio photo ${index + 1}`}
                    aria-pressed={selected}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="max-h-full max-w-full object-contain object-center"
                      decoding="async"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex shrink-0 gap-2.5 border-t border-neutral-100 px-3 py-3.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[4.5rem] flex-1 rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-100"
                />
              ))}
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
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
              <dl className="divide-y divide-neutral-100 px-5">
                {facts.howTheyWork.length > 0 ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">How they work</dt>
                    <dd className="text-sm text-neutral-800">{facts.howTheyWork.join(" · ")}</dd>
                  </div>
                ) : null}
                {facts.travelRadiusLabel ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">Travel radius</dt>
                    <dd className="text-sm text-neutral-800">{facts.travelRadiusLabel}</dd>
                  </div>
                ) : null}
                {facts.travelFeePolicy ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">Travel fees</dt>
                    <dd className="text-sm text-neutral-800">{facts.travelFeePolicy}</dd>
                  </div>
                ) : null}
                {facts.travelCustomNote ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">Travel note</dt>
                    <dd className="text-sm leading-relaxed text-neutral-800">
                      {facts.travelCustomNote}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          {hasGoodToKnow ? (
            <div className="border-t border-neutral-100">
              <div className="px-5 pt-4 pb-1">
                <h4 className="text-sm font-semibold text-neutral-900">Good to know</h4>
              </div>
              <dl className="divide-y divide-neutral-100 px-5">
                {facts.availableDays ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">Usually available</dt>
                    <dd className="text-sm text-neutral-800">{facts.availableDays}</dd>
                  </div>
                ) : null}
                {facts.unavailableDatesLabel ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">Not available</dt>
                    <dd className="text-sm leading-relaxed text-neutral-800">
                      {facts.unavailableDatesLabel}
                    </dd>
                  </div>
                ) : null}
                {facts.foodNotes.map((note) => (
                  <div
                    key={note.label}
                    className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6"
                  >
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">{note.label}</dt>
                    <dd className="text-sm leading-relaxed text-neutral-800">{note.value}</dd>
                  </div>
                ))}
                {facts.trustBadges.length > 0 ? (
                  <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
                    <dt className="shrink-0 text-sm text-neutral-500 sm:w-36">On file</dt>
                    <dd className="text-sm text-neutral-800">{facts.trustBadges.join(" · ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </section>

        <VendorReviewsSection vendorUserId={vendor.user_id} />
      </div>

      <aside className="lg:sticky lg:top-2">
        <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="px-5 pt-5 pb-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Pricing &amp; booking
            </h3>
            <p className="mt-1 text-[13px] text-neutral-400">
              {onRequestBooking
                ? "Select what you need, then request a booking."
                : "Sign in to book or message this vendor."}
            </p>
            {usualReplyExpectation(vendor.avg_response_seconds) ? (
              <p className="mt-2 text-[13px] text-neutral-600">
                {usualReplyExpectation(vendor.avg_response_seconds)}
              </p>
            ) : null}
          </div>

          <ul className="max-h-[min(65vh,520px)] divide-y divide-neutral-100 overflow-y-auto overscroll-contain border-t border-neutral-100">
            {pricingOptions.map((opt) => {
              const isOpen = detailOpenId === opt.id;
              const showCheckbox = Boolean(onRequestBooking);
              const selected = selectedPackageIds.has(opt.id);
              return (
                <li
                  key={opt.id}
                  className={`px-5 py-5 transition ${selected ? "bg-primary/[0.03]" : "bg-white"}`}
                >
                  <BrowsePricingOptionCard
                    opt={opt}
                    isOpen={isOpen}
                    showCheckbox={showCheckbox}
                    selected={selected}
                    onToggleSelect={() => togglePackage(opt.id)}
                    onToggleDetails={() => setDetailOpenId(isOpen ? null : opt.id)}
                  />
                </li>
              );
            })}
          </ul>

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
      </aside>

      {lightboxOpen && portfolioUrls.length > 0 ? (
        <PortfolioLightbox
          urls={portfolioUrls}
          index={activePhotoIndex}
          alt={`${businessName} portfolio`}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setActivePhotoIndex}
        />
      ) : null}
    </div>
  );
}
