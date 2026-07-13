"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type AuthRouteRedirectProps = {
  /** Destination path, e.g. "/login" or "/register". */
  to: string;
  /** Extra query params to force onto the destination (e.g. `{ type: "vendor" }`). */
  forceParams?: Record<string, string>;
};

/** Keeps a legacy auth URL (e.g. `/vendor/login`) working by forwarding to the unified route. */
function Redirect({ to, forceParams }: AuthRouteRedirectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(forceParams ?? {})) {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${to}?${qs}` : to);
  }, [router, searchParams, to, forceParams]);

  return (
    <main className="min-h-screen bg-auth-bg px-4 py-10">
      <p className="text-center text-sm text-neutral-600">Redirecting…</p>
    </main>
  );
}

export function AuthRouteRedirect(props: AuthRouteRedirectProps) {
  return <Redirect {...props} />;
}
