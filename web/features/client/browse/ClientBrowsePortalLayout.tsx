"use client";

import type { ReactNode } from "react";
import { RequireClient } from "@/components/auth/RequireClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { portalPageTitle } from "@/components/portal-shell/portalNav";
import { LoadingState } from "@/components/ui/LoadingState";
import { ClientOnboardingProvider } from "@/features/client/onboarding/ClientOnboardingProvider";
import { ClientWelcomeOnboardingModal } from "@/features/client/onboarding/ClientWelcomeOnboardingModal";

type ClientBrowsePortalLayoutProps = {
  pathname: string;
  children: ReactNode;
};

/**
 * Browse is public, but signed-in clients should see the same portal sidebar as
 * dashboard/bookings. Guests and other roles keep the public marketplace chrome
 * from the page components themselves.
 */
export function ClientBrowsePortalLayout({ pathname, children }: ClientBrowsePortalLayoutProps) {
  const { user, loading } = useAuth();
  const isClient = user?.user_type === "client";

  if (loading) {
    return <LoadingState label="Loading browse…" variant="centered" branded />;
  }

  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <RequireClient>
      <ClientOnboardingProvider>
        <PortalShell portal="client" title={portalPageTitle(pathname, "client")}>
          {children}
        </PortalShell>
        <ClientWelcomeOnboardingModal />
      </ClientOnboardingProvider>
    </RequireClient>
  );
}
