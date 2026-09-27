"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/foundation/ui";
import { fetchVendorProfile } from "@/domains/vendor-shell/api";
import { vendorIsLiveApproved } from "@/domains/vendor-shell/vendorAccess";

/**
 * Gates the full vendor portal (dashboard, bookings, payments, notifications,
 * analytics, disputes) behind `vendorIsLiveApproved`. `/vendor/profile`,
 * `/vendor/help`, `/vendor/contact` and `/vendor/settings` skip this guard
 * (see `isVendorPreApprovalRoute` in the layout) so a pending vendor can
 * finish onboarding, reach support, and manage their account.
 *
 * Ported from the baseline's `RequireVendorApproved`.
 */
export function RequireVendorApproved({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "approved" | "blocked">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchVendorProfile();
        if (cancelled) return;
        if (vendorIsLiveApproved(profile)) {
          setState("approved");
        } else {
          setState("blocked");
          router.replace("/vendor/profile");
        }
      } catch {
        if (cancelled) return;
        setState("blocked");
        router.replace("/vendor/profile");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== "approved") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState variant="inline" label="Checking your vendor profile" />
      </div>
    );
  }

  return <>{children}</>;
}
