"use client";

/**
 * Browse is public. A signed-in client keeps the portal sidebar; a guest,
 * vendor, or admin gets the marketing shell. Favorites stay at
 * `/client/favorites`, outside this path, so a guest there is still asked to sign in.
 */
import type { ComponentType, ReactNode } from "react";
import { MarketingShell } from "@/domains/marketing/MarketingShell";
import { useSession } from "@/foundation/session";
import { Spinner } from "@/foundation/ui";

type ClientBrowseLayoutProps = {
  pathname: string;
  children: ReactNode;
  /** The same portal tree the non-browse client routes use. */
  clientChrome: ComponentType<{ children: ReactNode }>;
};

/** Public browse chrome, or the client portal when the session is a client. */
export function ClientBrowseLayout({
  pathname,
  children,
  clientChrome: ClientChrome,
}: ClientBrowseLayoutProps) {
  const { status, session } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page-bg">
        <Spinner label="Loading browse…" />
      </div>
    );
  }

  if (session?.user.user_type === "client") {
    return <ClientChrome>{children}</ClientChrome>;
  }

  const width = pathname === "/client/browse" ? "wide" : "detail";
  return <MarketingShell width={width}>{children}</MarketingShell>;
}
