"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireCapability, RequireSession } from "@/foundation/session";
import { PortalShell } from "@/domains/vendor-shell/PortalShell";
import { RequireVendorApproved } from "@/domains/vendor-shell/RequireVendorApproved";
import { isVendorPreApprovalRoute } from "@/domains/vendor-shell/portalNav";

/**
 * Every authenticated vendor route shares this shell: sign-in required, the
 * account must be a vendor, and (outside onboarding/help/settings) the
 * vendor must be live-approved. New pages under `vendor/(portal)/*` get
 * this for free instead of repeating the wiring per `page.tsx`.
 */
export default function VendorPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const preApproval = isVendorPreApprovalRoute(pathname);

  return (
    <RequireSession>
      <RequireCapability permission="access_vendor_portal">
        {preApproval ? (
          <PortalShell preApproval>{children}</PortalShell>
        ) : (
          <RequireVendorApproved>
            <PortalShell>{children}</PortalShell>
          </RequireVendorApproved>
        )}
      </RequireCapability>
    </RequireSession>
  );
}
