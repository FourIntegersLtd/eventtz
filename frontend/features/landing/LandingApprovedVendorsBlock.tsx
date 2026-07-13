"use client";

import { ApprovedVendorsSection } from "@/features/client/browse/ApprovedVendorsSection";
import type { ExploreVendor } from "@/lib/clientExploreApi";
import { LANDING_PAGE_CONTAINER_CLASS } from "@/features/landing/landingSectionStyles";

type LandingApprovedVendorsBlockProps = {
  vendors: ExploreVendor[];
  loading: boolean;
  error: string | null;
};

export function LandingApprovedVendorsBlock({
  vendors,
  loading,
  error,
}: LandingApprovedVendorsBlockProps) {
  return (
    <section className={`py-14 sm:py-16 ${LANDING_PAGE_CONTAINER_CLASS}`}>
      <ApprovedVendorsSection
        query=""
        vendors={vendors}
        loading={loading}
        error={error}
        title="Browse top vendors"
        emptyLabel="No vendors found."
        maxItems={6}
      />
    </section>
  );
}
