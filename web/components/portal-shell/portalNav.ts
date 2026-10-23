import {
  BarChart3,
  CalendarDays,
  Compass,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PortalRole } from "@/lib/portalRole";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const CLIENT_NAV: readonly PortalNavItem[] = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/planner", label: "Plan my event", icon: Sparkles },
  { href: "/client/browse", label: "Browse vendors", icon: Compass },
  { href: "/client/favorites", label: "Favourites", icon: Heart },
  { href: "/client/bookings", label: "My bookings", icon: CalendarDays },
  { href: "/client/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/client/help", label: "Help", icon: LifeBuoy },
  { href: "/client/settings", label: "Settings", icon: Settings },
];

const VENDOR_NAV: readonly PortalNavItem[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/vendor/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/vendor/profile", label: "Profile", icon: UserCircle2 },
  { href: "/vendor/payments", label: "Payments", icon: Wallet },
  { href: "/vendor/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
];

export function portalNavItems(
  role: PortalRole,
  options?: { vendorPreApproval?: boolean },
): readonly PortalNavItem[] {
  if (role === "client") return CLIENT_NAV;
  if (!options?.vendorPreApproval) return VENDOR_NAV;
  const pendingHrefs = new Set(["/vendor/profile", "/vendor/settings"]);
  return VENDOR_NAV.filter((item) => pendingHrefs.has(item.href));
}

/** True when `pathname` is the nav item or a nested route under it. */
export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type PortalRouteKey =
  | "dashboard"
  | "planner"
  | "bookings"
  | "messages"
  | "disputes"
  | "contact"
  | "help"
  | "settings"
  | "notifications"
  | "browse"
  | "favorites"
  | "profile"
  | "payments";

const PORTAL_ROUTES: Record<PortalRole, Record<PortalRouteKey, string>> = {
  client: {
    dashboard: "/client/dashboard",
    planner: "/client/planner",
    bookings: "/client/bookings",
    messages: "/client/help",
    disputes: "/client/disputes",
    contact: "/client/help?tab=contact",
    help: "/client/help",
    settings: "/client/settings",
    notifications: "/client/notifications",
    browse: "/client/browse",
    favorites: "/client/favorites",
    profile: "/client/settings",
    payments: "/client/payments",
  },
  vendor: {
    dashboard: "/vendor/dashboard",
    planner: "/vendor/dashboard",
    bookings: "/vendor/bookings",
    messages: "/vendor/help",
    disputes: "/vendor/disputes",
    contact: "/vendor/help?tab=contact",
    help: "/vendor/help",
    settings: "/vendor/settings",
    notifications: "/vendor/notifications",
    browse: "/vendor/dashboard",
    favorites: "/vendor/dashboard",
    profile: "/vendor/profile",
    payments: "/vendor/payments",
  },
};

export function portalRoute(role: PortalRole, key: PortalRouteKey): string {
  return PORTAL_ROUTES[role][key];
}

const PAGE_TITLE_RULES: Record<PortalRole, readonly { prefix: string; title: string }[]> = {
  client: [
    { prefix: "/client/help", title: "Help" },
    { prefix: "/client/disputes", title: "Help and disputes" },
    { prefix: "/client/settings/reviews", title: "My reviews" },
    { prefix: "/client/payments", title: "My bookings" },
    { prefix: "/client/settings", title: "Settings" },
    { prefix: "/client/notifications", title: "Notifications" },
    { prefix: "/client/favorites", title: "Favourites" },
    { prefix: "/client/planner/", title: "Your plan" },
    { prefix: "/client/planner", title: "Plan my event" },
    { prefix: "/client/browse", title: "Browse vendors" },
    { prefix: "/client/dashboard", title: "Dashboard" },
    { prefix: "/client/bookings", title: "My bookings" },
  ],
  vendor: [
    { prefix: "/vendor/help", title: "Help" },
    { prefix: "/vendor/bookings", title: "Bookings" },
    { prefix: "/vendor/analytics", title: "Analytics" },
    { prefix: "/vendor/payments", title: "Payments" },
    { prefix: "/vendor/disputes", title: "Disputes" },
    { prefix: "/vendor/settings", title: "Settings" },
    { prefix: "/vendor/profile/reviews", title: "Client reviews" },
    { prefix: "/vendor/profile", title: "Vendor profile" },
    { prefix: "/vendor/notifications", title: "Notifications" },
    { prefix: "/vendor/dashboard", title: "Dashboard" },
  ],
};

/** Client booking sub-routes with their own topbar label (design C14–C16, C19). */
export function clientBookingPortalTopbarTitle(pathname: string): string | null {
  if (!pathname.startsWith("/client/bookings/")) return null;
  if (pathname.endsWith("/pay")) return "Pay";
  if (pathname.endsWith("/receipt")) return "Receipt";
  if (/\/client\/bookings\/[^/]+$/.test(pathname) && pathname.includes("payment")) {
    return "Booking payment";
  }
  return null;
}

export function portalPageTitle(pathname: string, role: PortalRole, search = ""): string {
  if (role === "client") {
    const bookingTitle = clientBookingPortalTopbarTitle(pathname);
    if (bookingTitle) return bookingTitle;
    if (/\/client\/bookings\/[^/]+$/.test(pathname) && /(?:^|&)rate=\d/.test(search)) {
      return "Review";
    }
    if (/\/client\/bookings\/[^/]+$/.test(pathname) && /(?:^|&)(checkout|payment)=/.test(search)) {
      return "Booking payment";
    }
  }
  for (const { prefix, title } of PAGE_TITLE_RULES[role]) {
    if (pathname.startsWith(prefix)) return title;
  }
  return "";
}

/** Master-detail detail routes hide the shell title on mobile (thread has its own back link). */
export function portalHidePageTitleOnMobile(pathname: string, role: PortalRole): boolean {
  const base = role === "client" ? "/client" : "/vendor";
  return (
    /^\/[^/]+\/(messages|bookings|help\/messages)\/[^/]+/.test(pathname) &&
    pathname.startsWith(base)
  );
}

export function portalDashboardHref(role: PortalRole): string {
  return portalRoute(role, "dashboard");
}
