"use client";

import { ClientEzPageHead } from "@/features/client/ui/ClientEzPageHead";
import { ClientOwnReviewsSection } from "@/features/client/reviews/ClientOwnReviewsSection";

export default function ClientSettingsReviewsPage() {
  return (
    <div className="ez-stack ez-stack--lg min-w-0 max-w-3xl">
      <ClientEzPageHead title="My reviews" description="Reviews from completed bookings." />
      <ClientOwnReviewsSection showShell={false} />
    </div>
  );
}
