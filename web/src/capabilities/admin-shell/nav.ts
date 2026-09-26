/**
 * The admin console's side navigation, matching `frontend/components/admin-shell/AdminShell.tsx`'s
 * `ADMIN_NAV`. Order is the order shown in the sidebar.
 */
export interface AdminNavItem {
  label: string;
  href: string;
  /** Hidden from the nav (and its route left unreachable via a gate) for a plain admin. */
  superAdminOnly?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Commerce", href: "/admin/commerce" },
  { label: "Directory", href: "/admin/directory" },
  { label: "Referrals", href: "/admin/referrals" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Report a bug", href: "/admin/report-bug" },
  { label: "Blog", href: "/admin/blog" },
  { label: "Trust & safety", href: "/admin/trust" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Team", href: "/admin/team" },
  { label: "Activity log", href: "/admin/audit" },
  { label: "Email health", href: "/admin/email", superAdminOnly: true },
];
