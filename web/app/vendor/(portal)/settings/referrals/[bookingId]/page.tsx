"use client";

import { useParams } from "next/navigation";
import { VendorReferralDetailView } from "@/features/settings/VendorReferralDetailView";

/** One client who booked through this vendor's referral link. */
export default function VendorReferralDetailPage() {
  const params = useParams();
  const bookingId = typeof params?.bookingId === "string" ? params.bookingId : "";

  if (!bookingId) {
    return <p className="ez-small">Missing referral.</p>;
  }

  return <VendorReferralDetailView bookingId={bookingId} />;
}
