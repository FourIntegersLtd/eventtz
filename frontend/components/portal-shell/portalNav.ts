import {
  BarChart3,
  CalendarDays,
  Compass,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  ShieldAlert,
  UserCircle2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type PortalRole = "client" | "vendor";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const CLIENT_NAV: readonly PortalNavItem[] = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/browse", label: "Browse", icon: Compass },
  { href: "/client/favorites", label: "Favorites", icon: Heart },
  { href: "/client/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/client/messages", label: "Messages", icon: MessageSquare },
  { href: "/client/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/client/contact", label: "Contact", icon: LifeBuoy },
  { href: "/client/settings", label: "Settings", icon: Settings },
];

const VENDOR_NAV: readonly PortalNavItem[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/vendor/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/vendor/messages", label: "Messages", icon: MessageSquare },
  { href: "/vendor/profile", label: "Profile", icon: UserCircle2 },
  { href: "/vendor/payments", label: "Payments", icon: Wallet },
  { href: "/vendor/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/vendor/contact", label: "Contact", icon: LifeBuoy },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
];

export function portalNavItems(role: PortalRole): readonly PortalNavItem[] {
  return role === "client" ? CLIENT_NAV : VENDOR_NAV;
}

/** True when `pathname` is the nav item or a nested route under it. */
export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href.endsWith("/dashboard")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type PortalRouteKey =
  | "dashboard"
  | "bookings"
  | "messages"
  | "disputes"
  | "contact"
  | "settings"
  | "notifications"
  | "browse"
  | "favorites"
  | "profile"
  | "payments";

const PORTAL_ROUTES: Record<PortalRole, Record<PortalRouteKey, string>> = {
  client: {
    dashboard: "/client/dashboard",
    bookings: "/client/bookings",
    messages: "/client/messages",
    disputes: "/client/disputes",
    contact: "/client/contact",
    settings: "/client/settings",
    notifications: "/client/notifications",
    browse: "/client/browse",
    favorites: "/client/favorites",
    profile: "/client/settings",
    payments: "/client/settings",
  },
  vendor: {
    dashboard: "/vendor/dashboard",
    bookings: "/vendor/bookings",
    messages: "/vendor/messages",
    disputes: "/vendor/disputes",
    contact: "/vendor/contact",
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
    { prefix: "/client/messages", title: "Messages" },
    { prefix: "/client/bookings", title: "My bookings" },
    { prefix: "/client/disputes", title: "Disputes" },
    { prefix: "/client/contact", title: "Contact us" },
    { prefix: "/client/settings/reviews", title: "Your reviews" },
    { prefix: "/client/payments", title: "Payment history" },
    { prefix: "/client/settings", title: "Settings" },
    { prefix: "/client/notifications", title: "Notifications" },
    { prefix: "/client/favorites", title: "Favorites" },
    { prefix: "/client/browse", title: "Browse vendors" },
    { prefix: "/client/dashboard", title: "Dashboard" },
  ],
  vendor: [
    { prefix: "/vendor/messages", title: "Messages" },
    { prefix: "/vendor/bookings", title: "Bookings" },
    { prefix: "/vendor/analytics", title: "Analytics" },
    { prefix: "/vendor/payments", title: "Payments" },
    { prefix: "/vendor/disputes", title: "Disputes" },
    { prefix: "/vendor/contact", title: "Contact us" },
    { prefix: "/vendor/settings", title: "Settings" },
    { prefix: "/vendor/profile/reviews", title: "Client reviews" },
    { prefix: "/vendor/profile", title: "Vendor profile" },
    { prefix: "/vendor/notifications", title: "Notifications" },
    { prefix: "/vendor/dashboard", title: "Dashboard" },
  ],
};

export function portalPageTitle(pathname: string, role: PortalRole): string {
  for (const { prefix, title } of PAGE_TITLE_RULES[role]) {
    if (pathname.startsWith(prefix)) return title;
  }
  return "";
}

export function portalDashboardHref(role: PortalRole): string {
  return portalRoute(role, "dashboard");
}
