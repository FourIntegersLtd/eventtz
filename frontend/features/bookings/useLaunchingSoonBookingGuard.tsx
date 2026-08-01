"use client";

import { useCallback, useState } from "react";
import { LaunchingSoonBookingModal } from "@/features/bookings/LaunchingSoonBookingModal";
import { BOOKINGS_LAUNCHING_SOON } from "@/lib/bookingsLaunchingSoon";

export function useLaunchingSoonBookingGuard() {
  const [open, setOpen] = useState(false);

  const guardBooking = useCallback((action?: () => void) => {
    if (BOOKINGS_LAUNCHING_SOON) {
      setOpen(true);
      return true;
    }
    action?.();
    return false;
  }, []);

  const launchingSoonModal = (
    <LaunchingSoonBookingModal isOpen={open} onClose={() => setOpen(false)} />
  );

  return { guardBooking, launchingSoonModal, isLaunchingSoon: BOOKINGS_LAUNCHING_SOON };
}
