"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LaunchingSoonBookingModal } from "@/features/bookings/LaunchingSoonBookingModal";
import { BOOKINGS_LAUNCHING_SOON, hasBookingEarlyAccess } from "@/lib/bookingsLaunchingSoon";

/** Pure guard check — used by the hook and unit tests. */
export function isBookingBlockedByLaunchGuard(email: string | null | undefined): boolean {
  return BOOKINGS_LAUNCHING_SOON && !hasBookingEarlyAccess(email);
}

export function runLaunchingSoonGuard(
  blocked: boolean,
  action?: () => void,
): boolean {
  if (blocked) return true;
  action?.();
  return false;
}

export function useLaunchingSoonBookingGuard() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isLaunchingSoon = isBookingBlockedByLaunchGuard(user?.email);

  const guardBooking = useCallback(
    (action?: () => void) => {
      if (runLaunchingSoonGuard(isLaunchingSoon, action)) {
        setOpen(true);
        return true;
      }
      return false;
    },
    [isLaunchingSoon],
  );

  const launchingSoonModal = (
    <LaunchingSoonBookingModal isOpen={open} onClose={() => setOpen(false)} />
  );

  return { guardBooking, launchingSoonModal, isLaunchingSoon };
}
