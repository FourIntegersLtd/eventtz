"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClientBrowseLayout } from "./browse/ClientBrowseLayout";
import { ClientPortalChrome } from "./ClientPortalChrome";

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
