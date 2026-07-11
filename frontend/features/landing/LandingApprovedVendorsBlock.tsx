"use client";

import { ApprovedVendorsSection } from "@/features/client/browse/ApprovedVendorsSection";
import type { ExploreVendor } from "@/lib/clientExploreApi";

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
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-12">
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
