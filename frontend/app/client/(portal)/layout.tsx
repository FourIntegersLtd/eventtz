"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireClient } from "@/components/auth/RequireClient";
import { PortalShell } from "@/components/portal-shell/PortalShell";

function titleForPathname(pathname: string): string {
  if (pathname.startsWith("/client/messages")) return "Messages";
  if (pathname.startsWith("/client/bookings")) return "My bookings";
  if (pathname.startsWith("/client/settings")) return "Settings";
  if (pathname.startsWith("/client/notifications")) return "Notifications";
  if (pathname.startsWith("/client/favorites")) return "Favorites";
  if (pathname.startsWith("/client/browse")) return "Browse vendors";
  if (pathname.startsWith("/client/dashboard")) return "Dashboard";
  return "";
}

/**
 * Every authenticated client route shares this shell — new routes under
 * `/client/(portal)/*` get RequireAuth + PortalShell for free instead of
 * repeating the wiring per page.tsx.
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth redirectTo={`/login?next=${encodeURIComponent(pathname)}`}>
      <RequireClient>
        <PortalShell portal="client" title={titleForPathname(pathname)}>
          {children}
        </PortalShell>
      </RequireClient>
    </RequireAuth>
  );
}
