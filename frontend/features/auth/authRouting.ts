import type { UserType } from "@/lib/domain-types";

/** Where a signed-in user lands after auth, based on their resolved account type. */
export function dashboardPathForUserType(userType: UserType | undefined): string {
  if (userType === "vendor") return "/vendor/dashboard";
  if (userType === "admin") return "/admin/dashboard";
  return "/client/dashboard";
}

/**
 * Role-gated path prefixes. A `?next=` redirect target under one of these is only safe to
 * honor if the signed-in user's resolved role matches — otherwise the target's page just
 * renders a broken shell (RequireAuth checks session only, not role) with every data call
 * 403ing. This matters most when a user's role changes between sessions (e.g. a vendor
 * account promoted to admin still has an old `/login?next=/vendor/dashboard` link from a
 * stale session-expiry redirect).
 */
const ROLE_GATED_PATH_PREFIXES: { prefix: string; role: UserType }[] = [
  { prefix: "/vendor/", role: "vendor" },
  { prefix: "/admin/", role: "admin" },
  { prefix: "/client/dashboard", role: "client" },
  { prefix: "/client/bookings", role: "client" },
  { prefix: "/client/messages", role: "client" },
  { prefix: "/client/notifications", role: "client" },
];

/** Whether `nextPath` is safe to redirect to for a user resolved as `userType`. */
export function isNextPathAllowedForUserType(nextPath: string, userType: UserType | undefined): boolean {
  return ROLE_GATED_PATH_PREFIXES.every(
    ({ prefix, role }) => !nextPath.startsWith(prefix) || userType === role,
  );
}

/** Safe post-auth redirect target: honors `next` only when it matches the resolved role. */
export function resolvePostAuthPath(nextPath: string | null, userType: UserType | undefined): string {
  if (nextPath && nextPath.startsWith("/") && isNextPathAllowedForUserType(nextPath, userType)) {
    return nextPath;
  }
  return dashboardPathForUserType(userType);
}
