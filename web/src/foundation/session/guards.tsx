"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@/foundation/ui";
import { loginHref } from "@/foundation/session/loginHref";
import { useSession } from "@/foundation/session/SessionProvider";
import { can } from "@/foundation/session/types";
import type { Permission } from "@/foundation/session/types";

function Resolving() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Checking your session" />
    </div>
  );
}

/**
 * Everything behind a login. Ported from OSCE `platform-web`'s `RequireSession`.
 *
 * An anonymous visitor is redirected to sign in and back; there is no
 * "must change password" flag on `api/`'s `AuthUser` yet, so that half of
 * OSCE's guard is left out rather than invented.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status, ready, sessionExpired } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (status === "anonymous") router.replace(loginHref(pathname ?? "/", sessionExpired));
  }, [ready, status, sessionExpired, pathname, router]);

  if (!ready || status === "loading") return <Resolving />;
  if (status === "anonymous") return <Resolving />;
  return <>{children}</>;
}

/**
 * Sign-in and registration, for whoever has neither yet.
 *
 * A visitor who is already signed in and opens `/login` or `/register` is
 * sent on instead, so registering does not silently overwrite a live session.
 */
export function RequireAnonymous({ children, authenticatedHref = "/" }: { children: ReactNode; authenticatedHref?: string }) {
  const { status, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && status === "authenticated") router.replace(authenticatedHref);
  }, [ready, status, authenticatedHref, router]);

  if (ready && status === "authenticated") return <Resolving />;
  return <>{children}</>;
}

/** A screen gated by a permission derived from the session (see `types.ts`). */
export function RequireCapability({
  permission,
  children,
  fallback,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { session, ready, status } = useSession();
  if (!ready || status === "loading") return <Resolving />;
  if (!can(session, permission)) {
    return (
      fallback ?? (
        <div className="rounded-2xl border border-primary-border bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-900">You do not have access to this</p>
        </div>
      )
    );
  }
  return <>{children}</>;
}
