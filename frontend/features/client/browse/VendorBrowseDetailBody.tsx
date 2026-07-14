"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Check, Clock, Info, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { displayEventTypes, displayServicesOffered } from "./browseLabels";
import {
  buildBookingLineItems,
  buildBrowsePricingOptions,
  formatBookingTotalGbp,
  portfolioImageUrlsFromPayload,
} from "./vendorBrowseDetailModel";
import { VendorReviewsSection } from "./VendorReviewsSection";
import { PortfolioLightbox } from "./PortfolioLightbox";
import { getMarket, marketLocationFallback } from "@/lib/markets";

const TRAVEL_DELIVERY_LABELS: Record<string, string> = {
  fee_included: "Travel/delivery fee included",
  free_within_base_city:
    "Free delivery within base city (extra charges may apply outside this area)",
  fee_after_booking_request:
    "Travel/delivery fee will be provided after booking request",
  not_applicable: "Not applicable",
};

type VendorBrowseDetailBodyProps = {
  vendor: ExploreVendor;
  requireLoginForActions: boolean;
  /** Client sign-in (e.g. returning users). */
  loginHref: string;
  /** New visitors: create a client account before continuing. */
  registerHref: string;
  onContinue: () => void;
  /** Logged-in clients: opens booking with selected package/rate ids. Omit for non-clients — only contact is shown. */
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
  const city =
    payloadStr(p, "baseCity").trim() ||
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
  const travelRaw = payloadStr(p, "travelDeliveryPolicy").trim();
  const travel = travelRaw
    ? TRAVEL_DELIVERY_LABELS[travelRaw] ?? travelRaw
    : "";

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
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(260px,340px)] lg:items-start lg:gap-10">
      <div className="min-w-0 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
            <div className="pointer-events-none absolute left-4 top-4 z-10">
              <span className="inline-flex rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-neutral-900 shadow-sm ring-1 ring-black/5">
                {city}
              </span>
            </div>
            {activePhotoUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="group relative block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                aria-label={`Open ${businessName} portfolio fullscreen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePhotoUrl}
                  alt={`${businessName} portfolio`}
                  className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                  decoding="async"
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 via-white to-neutral-50">
                <span className="font-heading text-4xl font-semibold tracking-tight text-neutral-300 sm:text-5xl">
                  {businessName.slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {portfolioUrls.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto border-t border-neutral-200 bg-neutral-50/70 px-3 py-3">
              {portfolioUrls.map((url, index) => {
                const selected = index === activePhotoIndex;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActivePhotoIndex(index)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-white ring-2 transition ${
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
                      className="h-full w-full object-cover object-center"
                      decoding="async"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-2.5 border-t border-neutral-200 bg-neutral-50/70 px-3 py-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 flex-1 rounded-lg bg-neutral-100 ring-1 ring-inset ring-neutral-200/80"
                />
              ))}
            </div>
          )}
        </div>

        <section>
          <h3 className="font-heading text-base font-semibold text-neutral-900">
            About this vendor
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">{bio}</p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
            <h3 className="font-heading text-sm font-semibold text-neutral-900">
              Services &amp; event fit
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              What this vendor offers and the celebrations they cover.
            </p>
          </div>
          <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Services
              </h4>
              {serviceLabels.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {serviceLabels.map((label, i) => (
                    <li
                      key={`svc-${i}-${label}`}
                      className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-neutral-400">Not specified yet</p>
              )}
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Event types
              </h4>
              {eventLabels.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {eventLabels.map((label, i) => (
                    <li
                      key={`evt-${i}-${label}`}
                      className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-neutral-400">Not specified yet</p>
              )}
            </div>
            {travel ? (
              <div className="rounded-xl border border-dashed border-neutral-200/90 bg-neutral-50/70 px-3 py-3 sm:px-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Travel &amp; delivery
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">{travel}</p>
              </div>
            ) : null}
          </div>
        </section>

        <VendorReviewsSection vendorUserId={vendor.user_id} />
      </div>

      <aside className="lg:sticky lg:top-2">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3.5">
            <h3 className="font-heading text-sm font-semibold text-neutral-900">
              Pricing &amp; booking
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {onRequestBooking
                ? "Select packages to see your estimate."
                : "Sign in to book or message this vendor."}
            </p>
          </div>

          <div className="max-h-[min(65vh,520px)] space-y-3 overflow-y-auto overscroll-contain bg-neutral-50/60 p-3 sm:p-3.5">
            {pricingOptions.map((opt) => {
              const isOpen = detailOpenId === opt.id;
              const showCheckbox = Boolean(onRequestBooking);
              const selected = selectedPackageIds.has(opt.id);
              return (
                <div
                  key={opt.id}
                  className={`overflow-hidden rounded-xl border bg-white transition ${
                    selected
                      ? "border-neutral-300 shadow-sm"
                      : "border-neutral-200/90 hover:border-neutral-300"
                  }`}
                >
                  <div className="flex gap-3 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
                    {showCheckbox ? (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => togglePackage(opt.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary focus:ring-primary/30"
                        aria-label={`Include ${opt.heading}`}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 pb-3.5 sm:pb-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-neutral-900">
                          {opt.heading}
                        </p>
                        {opt.priceDisplay != null && opt.compareAtDisplay ? (
                          <p className="text-xs text-neutral-500 line-through">
                            GBP {opt.compareAtDisplay}
                          </p>
                        ) : null}
                      </div>
                      <p
                        className={`mt-1.5 text-sm leading-relaxed text-neutral-600 ${
                          isOpen ? "hidden" : "line-clamp-2"
                        }`}
                      >
                        {opt.description}
                      </p>
                      {opt.timelineLine ? (
                        <div className="mt-2 flex items-start gap-2 text-sm text-neutral-700">
                          <Clock
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span>{opt.timelineLine}</span>
                        </div>
                      ) : null}
                      {opt.promoLines.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {opt.promoLines.map((line) => (
                            <li
                              key={line}
                              className="text-xs font-medium text-amber-800"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {(opt.description?.trim() || opt.featureLines.length > 0) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDetailOpenId(isOpen ? null : opt.id)
                          }
                          className="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline"
                        >
                          {isOpen ? "Hide details" : "See what's included"}
                        </button>
                      ) : null}
                      {isOpen ? (
                        <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
                          {opt.description?.trim() ? (
                            <p className="text-sm text-neutral-700">{opt.description}</p>
                          ) : null}
                          {opt.featureLines.length > 0 ? (
                            <ul className="space-y-1.5">
                              {opt.featureLines.map((line) => (
                                <li
                                  key={line}
                                  className="flex items-start gap-2 text-sm text-neutral-800"
                                >
                                  <Check
                                    className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
                                    strokeWidth={2.5}
                                    aria-hidden
                                  />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-3.5 py-2.5 sm:px-4">
                    <p className="font-heading text-base font-semibold text-neutral-900">
                      {opt.priceDisplay != null ? (
                        <>
                          <span className="text-xs font-medium text-neutral-500">From </span>
                          GBP {opt.priceDisplay}
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-neutral-700">Quote</span>
                      )}
                    </p>
                    {opt.discountBadge ? (
                      <span className="text-[11px] font-semibold tracking-wide text-green-700 uppercase">
                        {opt.discountBadge}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold tracking-[0.12em] text-neutral-500 uppercase">
                        Package
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {onRequestBooking && selectedPackageIds.size > 0 ? (
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                Estimated total
              </p>
              <p className="mt-0.5 font-heading text-xl font-semibold text-neutral-900">
                {selectedTotal.label}
              </p>
              {selectedTotal.hasTbc ? (
                <p className="mt-1 text-xs text-neutral-600">
                  Includes items that need a custom quote from the vendor.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 border-t border-neutral-200 bg-white p-4">
            {requireLoginForActions ? (
              <>
                <div
                  className="flex gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                  role="status"
                >
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-neutral-800">
                    <span className="font-semibold text-neutral-900">
                      Sign in to contact this vendor.
                    </span>{" "}
                    Create a free client account below.
                  </p>
                </div>
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
              <div className="space-y-3">
                {bookingSelectError ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
