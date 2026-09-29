"use client";

/** The signed-in vendor, in the shape the onboarding wizard reads. */

import { useSession } from "@/foundation/session/SessionProvider";

/** Session user, whether the first check is still running, and sign-out. */
export function useAuth() {
  const { session, status, ready, signOut } = useSession();
  return {
    user: session?.user ?? null,
    loading: !ready || status === "loading",
    signOut,
  };
}
