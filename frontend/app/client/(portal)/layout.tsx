"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireClient } from "@/components/auth/RequireClient";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { portalPageTitle } from "@/components/portal-shell/portalNav";
import { ClientBrowsePortalLayout } from "@/features/client/browse/ClientBrowsePortalLayout";
import { ClientOnboardingProvider } from "@/features/client/onboarding/ClientOnboardingProvider";
import { ClientWelcomeOnboardingModal } from "@/features/client/onboarding/ClientWelcomeOnboardingModal";

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBrowse = pathname.startsWith("/client/browse");

  if (isBrowse) {
    return (
      <ClientBrowsePortalLayout pathname={pathname}>{children}</ClientBrowsePortalLayout>
    );
  }

  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireClient>
        <ClientOnboardingProvider>
          <PortalShell portal="client" title={portalPageTitle(pathname, "client")}>
            {children}
          </PortalShell>
          <ClientWelcomeOnboardingModal />
        </ClientOnboardingProvider>
      </RequireClient>
    </RequireAuth>
  );
}
