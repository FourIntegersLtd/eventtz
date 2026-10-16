"use client";

import { BackLink } from "@/components/ui/BackLink";
import { VendorProfileReviewsPanel } from "@/features/vendor/profile/VendorProfileReviewsPanel";

export default function VendorProfileReviewsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <BackLink href="/vendor/profile" label="Profile" icon="chevron" />
      <VendorProfileReviewsPanel />
    </div>
  );
}
