"use client";

import type React from "react";
import Link from "next/link";
import { useMemo } from "react";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import { VendorPortfolioCover } from "@/components/vendor/VendorPortfolioCover";
import { displayEventTypes, displayServicesOffered } from "@/features/client/browse/browseLabels";
import { marketLocationFallback } from "@/lib/markets";

type ApprovedVendorsSectionProps = {
  query: string;
  vendors: ExploreVendor[];
  loading: boolean;
  error: string | null;
  title?: string;
  subtitle?: React.ReactNode;
  emptyLabel?: string;
  maxItems?: number;
};

export function ApprovedVendorsSection({
  query,
  vendors,
  loading,
  error,
  title = "Approved vendors",
  subtitle,
  emptyLabel,
  maxItems,
}: ApprovedVendorsSectionProps) {
  const displayVendors = useMemo(
    () => (typeof maxItems === "number" ? vendors.slice(0, maxItems) : vendors),
    [maxItems, vendors],
  );

  return (
    <div>
      <h3 className="font-heading text-lg font-semibold text-neutral-900 sm:text-xl">
        {title}
      </h3>
      {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      {loading ? (
        <LoadingState label="Loading approved vendors…" variant="centered" className="mt-4 py-8" branded />
      ) : error ? (
        <LottieFailureInline message={error} className="mt-4" />
      ) : displayVendors.length === 0 ? (
        <LottieEmptyPanel
          className="mt-4"
          lottie="searchNoResults"
          title={emptyLabel ?? (query.trim() ? `No vendors match “${query}”.` : "No vendors found.")}
          description={query.trim() ? "Try a different search or browse all vendors." : undefined}
        />
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {displayVendors.map((v, index) => {
              const p = v.payload ?? {};
              const biz = (typeof p.businessName === "string" && p.businessName) || "Unnamed business";
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
              const eventsRaw = Array.isArray(p.eventTypes)
                ? p.eventTypes.map((s) => String(s))
                : [];
              const services = displayServicesOffered(servicesRaw).join(", ");
              const events = displayEventTypes(eventsRaw).join(", ");
              const hourly = typeof p.hourlyRate === "string" ? p.hourlyRate.trim() : "";
              const priceLabel = hourly ? `From GBP ${hourly}/hr` : "Request custom quote";

              return (
                <MotionStaggerItem
                  key={v.user_id}
                  index={index}
                  className="h-full w-full min-w-0"
                >
                  <Link
                    href={`/client/browse/${v.user_id}`}
                    className="group flex h-full w-full min-w-0 flex-col rounded-2xl border border-neutral-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    <VendorPortfolioCover
                      payload={p}
                      businessName={biz}
                      overlay={
                        <p className="inline-flex rounded-full border border-primary/20 bg-white/95 px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
                          {city}
                        </p>
                      }
                    />
                    <h4 className="font-heading mt-3 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-neutral-900 group-hover:text-primary">
                      {biz}
                    </h4>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-neutral-600">{bio}</p>
                    <div className="mt-auto pt-3">
                      <p className="text-sm font-medium text-neutral-900">{priceLabel}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-600">
                        {services || "Services coming soon"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                        {events || "Events not specified"}
                      </p>
                    </div>
                  </Link>
                </MotionStaggerItem>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
