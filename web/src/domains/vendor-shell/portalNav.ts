/**
 * Navigation and page-title rules shared by every vendor portal route.
 *
 * Ported from the baseline's `frontend/components/portal-shell/portalNav.ts`
 * (vendor half only — the client portal is a different workstream). The
 * baseline draws each item with a `lucide-react` icon; `web/` has no icon
 * library dependency yet (see this workstream's hand-off), so items are
 * label-only until an icon set is approved.
 */

export interface VendorNavItem {
  href: string;
  label: string;
}

/** Full vendor portal navigation, shown once a vendor is live-approved. */
export const VENDOR_NAV: readonly VendorNavItem[] = [
  { href: "/vendor/dashboard", label: "Dashboard" },
  { href: "/vendor/analytics", label: "Analytics" },
  { href: "/vendor/bookings", label: "Bookings" },
  { href: "/vendor/help", label: "Help" },
  { href: "/vendor/profile", label: "Profile" },
  { href: "/vendor/payments", label: "Payments" },
  { href: "/vendor/disputes", label: "Disputes" },
  { href: "/vendor/settings", label: "Settings" },
];

/** Routes a not-yet-approved vendor may still reach (kept in sync with `isVendorPreApprovalRoute`). */
const PRE_APPROVAL_HREFS = new Set(["/vendor/profile", "/vendor/help", "/vendor/settings"]);

/** Which nav items to show: everything once approved, otherwise only the pre-approval routes. */
export function vendorNavItems(options?: { preApproval?: boolean }): readonly VendorNavItem[] {
  if (!options?.preApproval) return VENDOR_NAV;
  return VENDOR_NAV.filter((item) => PRE_APPROVAL_HREFS.has(item.href));
}

/** True when `pathname` is exactly the nav item's route, or nested under it. */
export function isVendorNavActive(pathname: string, href: string): boolean {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PAGE_TITLE_RULES: readonly { prefix: string; title: string }[] = [
  { prefix: "/vendor/help", title: "Help" },
  { prefix: "/vendor/bookings", title: "Bookings" },
  { prefix: "/vendor/analytics", title: "Analytics" },
  { prefix: "/vendor/payments", title: "Payments" },
  { prefix: "/vendor/disputes", title: "Disputes" },
  { prefix: "/vendor/settings", title: "Settings" },
  { prefix: "/vendor/profile/reviews", title: "Client reviews" },
  { prefix: "/vendor/profile", title: "Vendor profile" },
  { prefix: "/vendor/notifications", title: "Notifications" },
  { prefix: "/vendor/contact", title: "Contact us" },
  { prefix: "/vendor/dashboard", title: "Dashboard" },
];

/** The shell's header title for a given vendor pathname, or "" when none matches. */
export function vendorPortalPageTitle(pathname: string): string {
  for (const rule of PAGE_TITLE_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule.title;
  }
  return "";
}

/** Master-detail thread routes hide the shell title on mobile; the thread has its own back link. */
export function vendorHidePageTitleOnMobile(pathname: string): boolean {
  return /^\/vendor\/(messages|bookings|help\/messages)\/[^/]+/.test(pathname);
}

/** Routes a vendor may reach before they are live-approved. */
export function isVendorPreApprovalRoute(pathname: string): boolean {
  return [...PRE_APPROVAL_HREFS].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
