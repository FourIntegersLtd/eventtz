"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireCapability, RequireSession } from "@/foundation/session";
import {
  clientHidePageTitleOnMobile,
  clientNavItems,
  clientPortalPageTitle,
  isClientNavActive,
} from "@/domains/client-shell/portalNav";
import { PortalShell } from "@/surfaces/portal-shell/PortalShell";
import { ClientOnboardingProvider } from "@/domains/client-onboarding/ClientOnboardingProvider";
import { ClientWelcomeOnboardingModal } from "@/domains/client-onboarding/ClientWelcomeOnboardingModal";
import { ClientBrowseLayout } from "./browse/ClientBrowseLayout";

/**
 * Signed-in client chrome. Written once so browse and the rest of the portal
 * share the same shell, onboarding provider, and welcome modal.
 */
export function ClientPortalChrome({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <RequireCapability permission="access_client_portal">
        <ClientOnboardingProvider>
          <PortalShell
            homeHref="/client/dashboard"
            items={clientNavItems()}
            isNavActive={isClientNavActive}
            pageTitle={clientPortalPageTitle}
            hidePageTitleOnMobile={clientHidePageTitleOnMobile}
          >
            {children}
          </PortalShell>
          <ClientWelcomeOnboardingModal />
        </ClientOnboardingProvider>
      </RequireCapability>
    </RequireSession>
  );
}

/**
 * Client routes require a client session, except `/client/browse`, which is
 * public. Guests see marketing chrome from `ClientBrowseLayout`.
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/client/browse")) {
    return (
      <ClientBrowseLayout pathname={pathname} clientChrome={ClientPortalChrome}>
        {children}
      </ClientBrowseLayout>
    );
  }
  return <ClientPortalChrome>{children}</ClientPortalChrome>;
}
