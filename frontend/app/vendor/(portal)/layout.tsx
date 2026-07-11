"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireVendor } from "@/components/auth/RequireVendor";
import { RequireVendorApproved } from "@/components/auth/RequireVendorApproved";
import { PortalShell } from "@/components/portal-shell/PortalShell";

function titleForPathname(pathname: string): string {
  if (pathname.startsWith("/vendor/messages")) return "Messages";
  if (pathname.startsWith("/vendor/bookings")) return "Bookings";
  if (pathname.startsWith("/vendor/payments")) return "Payments";
  if (pathname.startsWith("/vendor/settings")) return "Settings";
  if (pathname.startsWith("/vendor/profile")) return "Vendor profile";
  if (pathname.startsWith("/vendor/notifications")) return "Notifications";
  if (pathname.startsWith("/vendor/dashboard")) return "Dashboard";
  return "";
}

/**
 * Every authenticated vendor route shares this shell — new routes under
 * `/vendor/(portal)/*` get RequireAuth + PortalShell for free instead of
 * repeating the wiring per page.tsx.
 */
export default function VendorPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProfileRoute = pathname.startsWith("/vendor/profile");
  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireVendor>
        {isProfileRoute ? (
          <PortalShell portal="vendor" title={titleForPathname(pathname)}>
            {children}
          </PortalShell>
        ) : (
          <RequireVendorApproved>
            <PortalShell portal="vendor" title={titleForPathname(pathname)}>
              {children}
            </PortalShell>
          </RequireVendorApproved>
        )}
      </RequireVendor>
    </RequireAuth>
  );
}
