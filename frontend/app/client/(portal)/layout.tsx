"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireClient } from "@/components/auth/RequireClient";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { portalPageTitle } from "@/components/portal-shell/portalNav";

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireClient>
        <PortalShell portal="client" title={portalPageTitle(pathname, "client")}>
          {children}
        </PortalShell>
      </RequireClient>
    </RequireAuth>
  );
}
