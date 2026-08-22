"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchVendorProfile } from "@/lib/vendorProfileApi";
import { vendorIsLiveApproved } from "@/lib/vendorAccess";

type RequireVendorApprovedProps = {
  children: ReactNode;
};

/**
 * Gates vendor portal pages (dashboard/bookings/payments/notifications) behind
 * `vendorIsLiveApproved`. `/vendor/profile` and `/vendor/help`
 * skip this guard (`isVendorPreApprovalRoute` in the portal layout) so vendors can
 * finish onboarding, reach support, and read Eventtz Support threads while pending.
 */
export function RequireVendorApproved({ children }: RequireVendorApprovedProps) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "approved" | "blocked">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchVendorProfile();
        if (cancelled) return;
        if (vendorIsLiveApproved(res)) {
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
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-neutral-600">Checking your vendor profile…</p>
      </div>
    );
  }

  return <>{children}</>;
}
