"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  hasStoredSession,
  installPlatformAuth,
  logout as apiLogout,
  PlatformError,
  platformRequest,
} from "@/foundation/platform-client";
import type { PlatformUser, Session, SessionState, SessionStatus } from "@/foundation/session/types";

const SessionContext = createContext<SessionState | null>(null);

// Installed at module scope so the very first request already carries a
// token; doing it inside an effect would race the fetches a page fires on mount.
let installed = false;
function ensureAuthInstalled() {
  if (installed) return;
  installed = true;
  installPlatformAuth();
}

interface MeResponse {
  success: boolean;
  user: PlatformUser;
}

/**
 * Resolves who is signed in, once, for the whole app.
 *
 * Ported from OSCE `platform-web`'s `SessionProvider`. It loads `GET
 * /auth/me`; see `foundation/session/types.ts` for why there is no separate
 * capabilities fetch yet.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  ensureAuthInstalled();
  const [session, setSession] = useState<Session | null>(null);
  /*
   * Always "loading" to begin with, on the server and on the first client
   * paint alike. Seeding this from `hasStoredSession()` reads `document.cookie`,
   * which does not exist during a server render, so the server and the
   * browser would decide differently and React would throw the first paint away.
   */
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [ready, setReady] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (!hasStoredSession()) {
      setSession(null);
      setSessionExpired(false);
      setStatus("anonymous");
      setReady(true);
      return;
    }
    try {
      const response = await platformRequest<MeResponse>("/api/v1/auth/me");
      setSession({ user: response.user });
      setSessionExpired(false);
      setStatus("authenticated");
    } catch (cause) {
      // A 401 means the stored pair was presented and refused. A network
      // failure is not that: the person still has a session, the server
      // just did not answer, and "your session expired" would be a lie.
      setSession(null);
      setSessionExpired(cause instanceof PlatformError && cause.status === 401);
      setStatus("anonymous");
    } finally {
      setReady(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Concurrent callers share one resolution; several screens ask at once
    // after a sign-in and each would otherwise fire its own `/auth/me`.
    inFlight.current ??= load().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setSession(null);
    setSessionExpired(false);
    setStatus("anonymous");
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, session, ready, sessionExpired, refresh, signOut }),
    [status, session, ready, sessionExpired, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within a SessionProvider");
  return context;
}
