"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireCapability, RequireSession } from "@/foundation/session";
import { RequireVendorApproved } from "@/domains/vendor-shell/RequireVendorApproved";
import {
  isVendorNavActive,
  isVendorPreApprovalRoute,
  vendorHidePageTitleOnMobile,
  vendorNavItems,
  vendorPortalPageTitle,
} from "@/domains/vendor-shell/portalNav";
import { PortalShell } from "@/surfaces/portal-shell/PortalShell";

/**
 * Every authenticated vendor route shares this shell: sign-in required, the
 * account must be a vendor, and (outside onboarding/help/settings) the
 * vendor must be live-approved. New pages under `vendor/(portal)/*` get
 * this for free instead of repeating the wiring per `page.tsx`.
 */
export default function VendorPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const preApproval = isVendorPreApprovalRoute(pathname);
  // The shared surface shell, configured with the vendor portal's own rules.
  const shell = (
    <PortalShell
      homeHref="/vendor/dashboard"
      items={vendorNavItems({ preApproval })}
      isNavActive={isVendorNavActive}
      pageTitle={vendorPortalPageTitle}
      hidePageTitleOnMobile={vendorHidePageTitleOnMobile}
    >
      {children}
    </PortalShell>
  );

  return (
    <RequireSession>
      <RequireCapability permission="access_vendor_portal">
        {preApproval ? shell : <RequireVendorApproved>{shell}</RequireVendorApproved>}
      </RequireCapability>
    </RequireSession>
  );
}
