"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireVendor } from "@/components/auth/RequireVendor";
import { RequireVendorApproved } from "@/components/auth/RequireVendorApproved";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { portalPageTitle } from "@/components/portal-shell/portalNav";

/**
 * Every authenticated vendor route shares this shell - new routes under
 * `/vendor/(portal)/*` get RequireAuth + PortalShell for free instead of
 * repeating the wiring per page.tsx.
 */
export default function VendorPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProfileRoute = pathname.startsWith("/vendor/profile");
  const isContactRoute = pathname.startsWith("/vendor/contact");
  const isMessagesRoute = pathname.startsWith("/vendor/messages");
  const title = portalPageTitle(pathname, "vendor");

  const preApprovalRoute = isProfileRoute || isContactRoute || isMessagesRoute;

  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireVendor>
        {preApprovalRoute ? (
          <PortalShell portal="vendor" title={title}>
            {children}
          </PortalShell>
        ) : (
          <RequireVendorApproved>
            <PortalShell portal="vendor" title={title}>
              {children}
            </PortalShell>
          </RequireVendorApproved>
        )}
      </RequireVendor>
    </RequireAuth>
  );
}
