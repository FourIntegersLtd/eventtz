"use client";

import Link from "next/link";
import { ClientOwnReviewsSection } from "@/features/client/reviews/ClientOwnReviewsSection";

export default function ClientSettingsReviewsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link
        href="/client/settings"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← Settings
      </Link>
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Your reviews</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Reviews you have left after completed bookings.
        </p>
      </header>
      <ClientOwnReviewsSection showShell={false} />
    </div>
  );
}
