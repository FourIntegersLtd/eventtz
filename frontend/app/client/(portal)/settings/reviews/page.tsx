"use client";

import { BackLink } from "@/components/ui/BackLink";
import { ClientOwnReviewsSection } from "@/features/client/reviews/ClientOwnReviewsSection";

export default function ClientSettingsReviewsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <BackLink href="/client/settings" label="Settings" icon="chevron" />
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Your reviews</h1>
        <p className="mt-1 text-sm text-neutral-600">Reviews from completed bookings.</p>
      </header>
      <ClientOwnReviewsSection showShell={false} />
    </div>
  );
}
