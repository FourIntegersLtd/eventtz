"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LaunchingSoonBookingModal } from "@/features/bookings/LaunchingSoonBookingModal";
import { BOOKINGS_LAUNCHING_SOON, hasBookingEarlyAccess } from "@/lib/bookingsLaunchingSoon";

export function useLaunchingSoonBookingGuard() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isLaunchingSoon = BOOKINGS_LAUNCHING_SOON && !hasBookingEarlyAccess(user?.email);

  const guardBooking = useCallback(
    (action?: () => void) => {
      if (isLaunchingSoon) {
        setOpen(true);
        return true;
      }
      action?.();
      return false;
    },
    [isLaunchingSoon],
  );

  const launchingSoonModal = (
    <LaunchingSoonBookingModal isOpen={open} onClose={() => setOpen(false)} />
  );

  return { guardBooking, launchingSoonModal, isLaunchingSoon };
}
