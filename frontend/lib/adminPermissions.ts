import { isSuperAdmin } from "@/lib/adminRole";

type AdminUser = Parameters<typeof isSuperAdmin>[0];

function isAdminUser(user: AdminUser): boolean {
  return user?.user_type === "admin";
}

/** Booking support action ids gated to super_admin (money / refunds / payouts). */
export const SUPER_ADMIN_BOOKING_ACTION_IDS = new Set([
  "sync",
  "reset",
  "payout",
  "complete-cancel",
  "confirm-client",
  "confirm-vendor",
  "hold",
  "maintenance",
  "cancel",
]);

export function canManageAdminTeam(user: AdminUser): boolean {
  return isSuperAdmin(user);
}

export function canRunBookingSupportActions(user: AdminUser): boolean {
  return isSuperAdmin(user);
}

export function canModerateVendors(user: AdminUser): boolean {
  return isAdminUser(user);
}

export function canSuspendClients(user: AdminUser): boolean {
  return isAdminUser(user);
}

/** Resolve dispute with refund / payout — super admin only. */
export function canResolveDisputesFinancially(user: AdminUser): boolean {
  return isSuperAdmin(user);
}

export function canModerateReviews(user: AdminUser): boolean {
  return isAdminUser(user);
}

export function canExportFinancials(user: AdminUser): boolean {
  return isSuperAdmin(user);
}
