import type { AuthUser } from "@/lib/auth-api";

/** Matches backend SUPER_ADMIN_EMAILS bootstrap until /me always returns admin_role. */
const BOOTSTRAP_SUPER_ADMIN_EMAILS = new Set(["hello@fourintegers.com"]);

function metaAdminRole(user: AuthUser): string | null {
  const fromApp = user.app_metadata?.admin_role;
  if (fromApp === "super_admin" || fromApp === "admin") return fromApp;
  const fromUser = user.user_metadata?.admin_role;
  if (fromUser === "super_admin" || fromUser === "admin") return fromUser;
  return null;
}

export function resolveAdminRole(
  user: { user_type?: string; admin_role?: string | null; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined,
): "super_admin" | "admin" | null {
  if (!user || user.user_type !== "admin") return null;
  if (user.admin_role === "super_admin" || user.admin_role === "admin") {
    return user.admin_role;
  }
  const metaRole = metaAdminRole(user as AuthUser);
  if (metaRole === "super_admin" || metaRole === "admin") {
    return metaRole;
  }
  const email = user.email?.trim().toLowerCase();
  if (email && BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email)) {
    return "super_admin";
  }
  return "admin";
}

export function isSuperAdmin(
  user: { user_type?: string; admin_role?: string | null; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return resolveAdminRole(user) === "super_admin";
}
