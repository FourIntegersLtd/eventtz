"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireClient } from "@/components/auth/RequireClient";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { portalPageTitle } from "@/components/portal-shell/portalNav";
import { ClientBrowsePortalLayout } from "@/features/client/browse/ClientBrowsePortalLayout";
import { ClientOnboardingProvider } from "@/features/client/onboarding/ClientOnboardingProvider";
import { ClientWelcomeOnboardingModal } from "@/features/client/onboarding/ClientWelcomeOnboardingModal";
import { LoadingState } from "@/components/ui/LoadingState";

function ClientPortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const portalTitle = portalPageTitle(pathname, "client", searchParams.toString());

  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireClient>
        <ClientOnboardingProvider>
          <PortalShell portal="client" title={portalTitle}>
            {children}
          </PortalShell>
          <ClientWelcomeOnboardingModal />
        </ClientOnboardingProvider>
      </RequireClient>
    </RequireAuth>
  );
}

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBrowse = pathname.startsWith("/client/browse");

  if (isBrowse) {
    return (
      <ClientBrowsePortalLayout pathname={pathname}>{children}</ClientBrowsePortalLayout>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Loading…" variant="centered" branded />}>
      <ClientPortalShell>{children}</ClientPortalShell>
    </Suspense>
  );
}
