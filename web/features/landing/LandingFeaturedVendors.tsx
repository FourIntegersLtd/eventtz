"use client";

import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchExploreVendorsSearch,
  type ExploreVendorSearchRow,
} from "@/lib/clientExploreApi";
import {
  MarketplaceVendorCard,
  marketplaceVendorCardGridClass,
  marketplaceVendorCardGridItemClass,
} from "@/features/marketplace/MarketplaceVendorCard";
import { expandVendorsForSearchResults } from "@/features/marketplace/marketplaceSearchModel";
import { FEATURED_VENDORS_SECTION } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/components/landing/LandingSection";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { MotionStaggerItem } from "@/components/ui/MotionStaggerItem";
import {
  LANDING_SECTION_CONTENT_MT,
  landingSectionClass,
} from "@/components/landing/landingSectionStyles";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export function LandingFeaturedVendors() {
  const [vendors, setVendors] = useState<ExploreVendorSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { vendors: rows } = await fetchExploreVendorsSearch({
          sort: "relevance",
          limit: 6,
          offset: 0,
        });
        if (!cancelled) setVendors(rows);
      } catch {
        if (!cancelled) setError("Could not load vendors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => expandVendorsForSearchResults(vendors, []), [vendors]);


  return (
    <LandingSection
      id="featured"
      className={landingSectionClass("muted", {
        shell: "content",
        extra: "sm:!pt-24 md:!pt-28",
      })}
      width="7xl"
    >
      <LandingSectionHeading
        eyebrow={FEATURED_VENDORS_SECTION.eyebrow}
        title={FEATURED_VENDORS_SECTION.title}
        align="left"
      />

      {loading ? (
        <LoadingState label="Loading featured vendors…" variant="centered" className={`${LANDING_SECTION_CONTENT_MT} py-12`} branded />
      ) : error ? (
        <LottieFailureInline message={error} className={LANDING_SECTION_CONTENT_MT} />
      ) : cards.length === 0 ? (
        <LottieEmptyPanel
          className={LANDING_SECTION_CONTENT_MT}
          lottie="searchNoResults"
          title="No vendors yet"
          description="We're onboarding vendors across the UK - check back soon"
        />
      ) : (
        <div className={`${LANDING_SECTION_CONTENT_MT} ${marketplaceVendorCardGridClass}`}>
          {cards.map((card, index) => (
            <MotionStaggerItem
              key={card.cardKey}
              index={index}
              className={marketplaceVendorCardGridItemClass}
            >
              <MarketplaceVendorCard
                card={card}
                showBookmark={false}
                onNavigate={(vendorUserId) =>
                  track(MixpanelEvents.landing_featured_vendor_clicked, {
                    vendor_user_id: vendorUserId,
                  })
                }
              />
            </MotionStaggerItem>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-center sm:mt-10">
        <ButtonLink
          href="/client/browse"
          variant="secondary"
          onClick={() =>
            track(MixpanelEvents.landing_cta_clicked, {
              cta: "view_all",
              location: "featured_vendors",
            })
          }
        >
          View all vendors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </div>
    </LandingSection>
  );
}
