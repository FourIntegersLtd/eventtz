import type { UserType } from "@/foundation/session";

/**
 * Post-auth routing, ported from the baseline's `features/auth/authRouting.ts`.
 *
 * The portal routes below (`/client/dashboard`, `/vendor/dashboard`,
 * `/admin/dashboard`) are not built in `web/` yet — they belong to
 * workstreams 14-17 — but the URLs must match `frontend/app` exactly
 * (AGENTS.md: "URLs are public contracts"), so this routes to them now and
 * they will simply 404 until those workstreams land.
 */

/** Where a signed-in user lands after auth, based on their resolved account type. */
export function dashboardPathForUserType(userType: UserType | undefined): string {
  if (userType === "vendor") return "/vendor/dashboard";
  if (userType === "admin") return "/admin/dashboard";
  return "/client/dashboard";
}

/**
 * Role-gated path prefixes. A `?next=` redirect target under one of these is
 * only safe to honour if the signed-in user's resolved role matches —
 * otherwise the target renders for the wrong role with every data call
 * failing.
 */
const ROLE_GATED_PATH_PREFIXES: { prefix: string; role: UserType }[] = [
  { prefix: "/vendor/", role: "vendor" },
  { prefix: "/admin/", role: "admin" },
  { prefix: "/client/dashboard", role: "client" },
  { prefix: "/client/bookings", role: "client" },
  { prefix: "/client/help", role: "client" },
  { prefix: "/client/messages", role: "client" },
  { prefix: "/client/contact", role: "client" },
  { prefix: "/client/notifications", role: "client" },
];

/** Whether `nextPath` is safe to redirect to for a user resolved as `userType`. */
export function isNextPathAllowedForUserType(nextPath: string, userType: UserType | undefined): boolean {
  return ROLE_GATED_PATH_PREFIXES.every(({ prefix, role }) => !nextPath.startsWith(prefix) || userType === role);
}

/** Whether `nextPath` targets the admin console (used to enforce admin-only sign-in). */
export function isAdminLoginIntent(nextPath: string | null | undefined): boolean {
  return Boolean(nextPath?.startsWith("/admin"));
}

/** Login URL that returns the user to a protected route after auth. */
export function loginPathWithNext(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

/** Safe post-auth redirect target: honours `next` only when it matches the resolved role. */
export function resolvePostAuthPath(nextPath: string | null, userType: UserType | undefined): string {
  if (nextPath && nextPath.startsWith("/") && isNextPathAllowedForUserType(nextPath, userType)) {
    return nextPath;
  }
  return dashboardPathForUserType(userType);
}
