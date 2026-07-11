"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchVendorProfile } from "@/lib/vendorProfileApi";

type RequireVendorApprovedProps = {
  children: ReactNode;
};

/**
 * Gates vendor portal pages (dashboard/bookings/messages/notifications) behind a
 * submitted + admin-approved profile. `/vendor/profile` itself is exempt (wired in
 * the portal layout) so vendors can finish onboarding and check their status there.
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
        const approved = res.status === "submitted" && res.approval_status === "approved";
        if (approved) {
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
