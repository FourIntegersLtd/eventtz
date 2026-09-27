"use client";

import type { ReactNode } from "react";
import { RequireCapability, RequireSession } from "@/foundation/session";
import {
  clientHidePageTitleOnMobile,
  clientNavItems,
  clientPortalPageTitle,
  isClientNavActive,
} from "@/domains/client-shell/portalNav";
import { PortalShell } from "@/surfaces/portal-shell/PortalShell";

/**
 * Every authenticated client route shares this shell: sign-in required and
 * the account must be a client. New pages under `client/(portal)/*` get
 * this for free instead of repeating the wiring per `page.tsx`.
 *
 * A signed-out visitor is redirected to sign in and back; a signed-in
 * vendor or admin sees the capability fallback — mirroring the reverse of
 * the vendor portal's layout.
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <RequireCapability permission="access_client_portal">
        <PortalShell
          homeHref="/client/dashboard"
          items={clientNavItems()}
          isNavActive={isClientNavActive}
          pageTitle={clientPortalPageTitle}
          hidePageTitleOnMobile={clientHidePageTitleOnMobile}
        >
          {children}
        </PortalShell>
      </RequireCapability>
    </RequireSession>
  );
}
