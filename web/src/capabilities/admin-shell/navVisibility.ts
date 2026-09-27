import { ADMIN_NAV, type AdminNavItem } from "@/capabilities/admin-shell/nav";

/** Sidebar and mobile menu items visible to the signed-in admin (super-admin-only links filtered out). */
export function visibleAdminNavItems(superAdmin: boolean): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => !item.superAdminOnly || superAdmin);
}
