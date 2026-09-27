"use client";

/**
 * Client half of the vendor profile route. Owns whether the booking panel is
 * open. This piece has no modal yet, so opening it renders nothing.
 */
import { useState } from "react";
import { VendorProfileView } from "@/domains/marketplace/VendorProfileView";

/** `/client/browse/[userId]` with the booking slot left empty for the next piece. */
export function VendorProfileRoute({ vendorUserId }: { vendorUserId: string }) {
  const [bookingOpen, setBookingOpen] = useState(false);
  return (
    <VendorProfileView
      key={vendorUserId}
      vendorUserId={vendorUserId}
      bookingOpen={bookingOpen}
      onRequestBooking={() => setBookingOpen(true)}
      onCloseBooking={() => setBookingOpen(false)}
    />
  );
}
