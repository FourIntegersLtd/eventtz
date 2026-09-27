"use client";

/**
 * Client half of the vendor profile route.
 * The booking modal is filled in only for a signed-in client. Guests keep the
 * register and login links on the profile.
 */
import { useState } from "react";
import { useSession } from "@/foundation/session";
import { VendorBookingModal } from "@/domains/marketplace/VendorBookingModal";
import { VendorProfileView } from "@/domains/marketplace/VendorProfileView";

/** `/client/browse/[userId]` with the booking request dialog. */
export function VendorProfileRoute({ vendorUserId }: { vendorUserId: string }) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const { session } = useSession();
  const isClient = session?.user.user_type === "client";

  return (
    <VendorProfileView
      key={vendorUserId}
      vendorUserId={vendorUserId}
      bookingOpen={bookingOpen}
      onRequestBooking={() => setBookingOpen(true)}
      onCloseBooking={() => setBookingOpen(false)}
      bookingModal={
        isClient
          ? (slot) => (
              <VendorBookingModal
                onClose={slot.close}
                vendorDisplayName={slot.vendorDisplayName}
                vendorUserId={vendorUserId}
                pricingOptions={slot.pricingOptions}
                initialSelectedIds={slot.selectedIds}
                initialQuantities={slot.quantities}
                vendorPayload={slot.vendorPayload}
                searchPrefill={slot.searchPrefill}
                initialPrefill={slot.initialPrefill}
                linkedEventId={slot.linkedEventId}
                clientSearchContext={slot.clientSearchContext}
                initialReferralCode={slot.initialReferralCode}
              />
            )
          : undefined
      }
    />
  );
}
