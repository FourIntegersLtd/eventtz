"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchExploreVendorsSearch,
  type ExploreVendorSearchRow,
} from "@/lib/clientExploreApi";
import { MarketplaceVendorCard } from "@/features/marketplace/MarketplaceVendorCard";
import { expandVendorsForSearchResults } from "@/features/marketplace/marketplaceSearchModel";
import { FEATURED_VENDORS_SECTION } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  LANDING_SECTION_CONTENT_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";

const MAX_ITEMS = 6;

export function LandingFeaturedVendors() {
  const [vendors, setVendors] = useState<ExploreVendorSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { vendors: rows } = await fetchExploreVendorsSearch({ sort: "relevance" });
        if (!cancelled) setVendors(rows);
      } catch {
        if (!cancelled) setError("Could not load vendors.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(
    () => expandVendorsForSearchResults(vendors, []).slice(0, MAX_ITEMS),
    [vendors],
  );

  return (
    <LandingSection id="featured" className={landingSectionClass("muted")} width="7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <LandingSectionHeading
          eyebrow={FEATURED_VENDORS_SECTION.eyebrow}
          title={FEATURED_VENDORS_SECTION.title}
          align="left"
        />
        <Link
          href="/client/browse"
          className="text-sm font-semibold text-primary transition hover:opacity-80"
        >
          View all vendors
        </Link>
      </div>

      {loading ? (
        <LoadingState label="Loading featured vendors…" variant="centered" className={`${LANDING_SECTION_CONTENT_MT} py-12`} />
      ) : error ? (
        <p className={`${LANDING_SECTION_CONTENT_MT} rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800`}>
          {error}
        </p>
      ) : cards.length === 0 ? (
        <p className={`${LANDING_SECTION_CONTENT_MT} rounded-2xl border border-primary-border bg-primary-soft px-4 py-6 text-center text-sm text-neutral-600`}>
          No vendors yet.
        </p>
      ) : (
        <div className={`${LANDING_SECTION_CONTENT_MT} grid gap-5 sm:grid-cols-2 lg:grid-cols-3`}>
          {cards.map((card) => (
            <MarketplaceVendorCard key={card.cardKey} card={card} showBookmark={false} />
          ))}
        </div>
      )}
    </LandingSection>
  );
}
