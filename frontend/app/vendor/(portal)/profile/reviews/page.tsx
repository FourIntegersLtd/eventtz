"use client";

import Link from "next/link";
import { VendorProfileReviewsPanel } from "@/features/vendor/profile/VendorProfileReviewsPanel";

export default function VendorProfileReviewsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link
        href="/vendor/profile"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← Profile
      </Link>
      <VendorProfileReviewsPanel />
    </div>
  );
}
