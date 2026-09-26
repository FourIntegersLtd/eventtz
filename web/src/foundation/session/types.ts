import type { components } from "@/foundation/platform-client";

export type PlatformUser = components["schemas"]["AuthUser"];

/**
 * What the app knows about the person using it.
 *
 * The brief this workstream was built from (`docs/rebuild-workstreams.md`
 * §10, modelled on OSCE `platform-web`) calls for `SessionProvider` to load
 * `/me` and `/me/capabilities`. `api/`'s identity slice
 * (`api/app/features/identity/router.py`) only exposes `GET /auth/me`; there
 * is no capabilities endpoint yet. `can()` below is a judgment call standing
 * in for it: it derives permissions from `user_type` and `admin_role` on the
 * `/auth/me` response, the same fields the baseline frontend's `AuthProvider`
 * already branches on (`frontend/components/auth/AuthProvider.tsx`). When a
 * real `/me/capabilities` endpoint exists, `can()` should switch to reading
 * it instead of re-deriving policy here.
 */
export interface Session {
  user: PlatformUser;
}

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionState {
  status: SessionStatus;
  session: Session | null;
  /** True once the first resolution has happened, however it went. */
  ready: boolean;
  /**
   * A stored token was presented and refused.
   * Distinct from a first visit, which is anonymous and has never held one.
   */
  sessionExpired: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** A client, vendor or staff member — the account's fixed kind. */
export type UserType = "client" | "vendor" | "admin";

/** Coarse-grained permissions this app checks before showing a screen or an action. */
export type Permission =
  | "access_client_portal"
  | "access_vendor_portal"
  | "access_admin_portal"
  | "manage_admin_team";

function userType(session: Session | null): UserType | null {
  const value = session?.user.user_type;
  return value === "client" || value === "vendor" || value === "admin" ? value : null;
}

/** Whether the signed-in account may do this. See the module doc for why this is derived, not fetched. */
export function can(session: Session | null, permission: Permission): boolean {
  const type = userType(session);
  if (!type) return false;
  switch (permission) {
    case "access_client_portal":
      return type === "client";
    case "access_vendor_portal":
      return type === "vendor";
    case "access_admin_portal":
      return type === "admin";
    case "manage_admin_team":
      return type === "admin" && session?.user.admin_role === "super_admin";
    default:
      return false;
  }
}

export function isAdmin(session: Session | null): boolean {
  return userType(session) === "admin";
}
