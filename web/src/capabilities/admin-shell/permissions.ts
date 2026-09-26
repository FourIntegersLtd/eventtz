import type { Session } from "@/foundation/session";

/**
 * Admin-vs-super-admin gating, matching `frontend/lib/adminPermissions.ts`.
 *
 * `foundation/session`'s `can()` only knows the coarse `manage_admin_team`
 * permission (super admin). The baseline's admin console gates several other
 * screens/actions to super admins too (booking money actions, dispute
 * resolution, financial CSV export, platform-wide broadcasts, listing
 * overrides). Rather than growing `foundation/session`'s `Permission` union
 * for admin-only concerns, this capability re-derives the same super-admin
 * check locally — it is a pure function of `session.user.admin_role`, no I/O.
 */
export function isSuperAdmin(session: Session | null): boolean {
  return session?.user.user_type === "admin" && session.user.admin_role === "super_admin";
}

/** The admin console's own capability matrix (baseline: `frontend/lib/adminPermissions.ts`). */
export const adminCapabilities = {
  canManageAdminTeam: isSuperAdmin,
  canRunBookingSupportActions: isSuperAdmin,
  canResolveDisputesFinancially: isSuperAdmin,
  canExportFinancials: isSuperAdmin,
  canBroadcastMessages: isSuperAdmin,
  canSendTestEmails: isSuperAdmin,
  // Any signed-in admin, regardless of role.
  canModerateReviews: (session: Session | null) => session?.user.user_type === "admin",
} as const;
