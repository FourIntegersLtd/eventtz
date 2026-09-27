/**
 * Navigation and page-title rules shared by every client portal route.
 *
 * Ported from the baseline's `frontend/components/portal-shell/portalNav.ts`
 * (client half only). The baseline draws each item with a `lucide-react`
 * icon; `web/` has no icon library dependency yet (see the vendor workstream's
 * hand-off), so items are label-only until an icon set is approved.
 */

export interface ClientNavItem {
  href: string;
  label: string;
}

/** Full client portal navigation, shown to every signed-in client. */
export const CLIENT_NAV: readonly ClientNavItem[] = [
  { href: "/client/dashboard", label: "Dashboard" },
  { href: "/client/planner", label: "Plan my event" },
  { href: "/client/browse", label: "Browse" },
  { href: "/client/favorites", label: "Favorites" },
  { href: "/client/bookings", label: "Bookings" },
  { href: "/client/help", label: "Help" },
  { href: "/client/disputes", label: "Disputes" },
  { href: "/client/settings", label: "Settings" },
];

/** Which nav items to show: everything, always — clients have no approval flow. */
export function clientNavItems(): readonly ClientNavItem[] {
  return CLIENT_NAV;
}

/** True when `pathname` is exactly the nav item's route, or nested under it. */
export function isClientNavActive(pathname: string, href: string): boolean {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PAGE_TITLE_RULES: readonly { prefix: string; title: string }[] = [
  { prefix: "/client/help", title: "Help" },
  { prefix: "/client/bookings", title: "My bookings" },
  { prefix: "/client/disputes", title: "Disputes" },
  { prefix: "/client/settings/reviews", title: "Your reviews" },
  { prefix: "/client/payments", title: "Payment history" },
  { prefix: "/client/settings", title: "Settings" },
  { prefix: "/client/notifications", title: "Notifications" },
  { prefix: "/client/favorites", title: "Favorites" },
  { prefix: "/client/planner", title: "Plan my celebration" },
  { prefix: "/client/browse", title: "Browse vendors" },
  { prefix: "/client/dashboard", title: "Dashboard" },
];

/** The shell's header title for a given client pathname, or "" when none matches. */
export function clientPortalPageTitle(pathname: string): string {
  for (const rule of PAGE_TITLE_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule.title;
  }
  return "";
}

/** Master-detail thread routes hide the shell title on mobile; the thread has its own back link. */
export function clientHidePageTitleOnMobile(pathname: string): boolean {
  return /^\/client\/(messages|bookings|help\/messages)\/[^/]+/.test(pathname);
}
