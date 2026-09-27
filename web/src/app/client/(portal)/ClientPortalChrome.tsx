"use client";

/**
 * The signed-in client portal tree, shared by `layout.tsx` and the browse layout.
 * It lives outside `layout.tsx` because Next.js allows a layout file to export
 * only its default component and route config.
 */

import type { ReactNode } from "react";
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
