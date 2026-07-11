"use client";

import Link from "next/link";
import {
  CalendarDays,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  UserCircle2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { AuthUser } from "@/lib/auth-api";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { installVisibilityRefresh } from "@/lib/useVisibilityRefresh";
import {
  BOOKING_NOTIFICATIONS_CLEARED_EVENT,
  fetchClientBookingNotificationsUnreadCount,
} from "@/lib/clientNotificationsApi";
import { CHAT_UNREAD_CLEARED_EVENT, fetchChatUnreadCount } from "@/lib/chatApi";
import { fetchVendorBookings } from "@/lib/vendorBookingsApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type PortalShellProps = {
  title: string;
  children: ReactNode;
  /** Client accounts use client routes only — no vendor onboarding/profile in the sidebar. */
  portal?: "vendor" | "client";
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const VENDOR_NAV: readonly NavItem[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/vendor/messages", label: "Messages", icon: MessageSquare },
  { href: "/vendor/profile", label: "Profile", icon: UserCircle2 },
  { href: "/vendor/payments", label: "Payments", icon: Wallet },
  { href: "/vendor/settings", label: "Settings", icon: Settings },
];

const CLIENT_NAV: readonly NavItem[] = [
  { href: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/client/browse", label: "Browse", icon: Compass },
  { href: "/client/favorites", label: "Favorites", icon: Heart },
  { href: "/client/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/client/messages", label: "Messages", icon: MessageSquare },
  { href: "/client/settings", label: "Settings", icon: Settings },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/vendor/bookings") return pathname.startsWith("/vendor/bookings");
  if (href === "/client/bookings") {
    return pathname === "/client/bookings" || pathname.startsWith("/client/bookings/");
  }
  if (href === "/client/messages") return pathname.startsWith("/client/messages");
  if (href === "/vendor/messages") return pathname.startsWith("/vendor/messages");
  if (href === "/client/browse") return pathname.startsWith("/client/browse");
  if (href === "/client/favorites") return pathname.startsWith("/client/favorites");
  if (href === "/vendor/profile") return pathname.startsWith("/vendor/profile");
  if (href === "/vendor/payments") return pathname.startsWith("/vendor/payments");
  if (href === "/vendor/settings") return pathname.startsWith("/vendor/settings");
  if (href === "/client/settings") return pathname.startsWith("/client/settings");
  return pathname === href;
}

function ShellNavLinks({
  navItems,
  pathname,
  portal,
  user,
  bookingUnread,
  chatUnread,
  vendorBookingsPending,
  onNavigate,
}: {
  navItems: readonly NavItem[];
  pathname: string;
  portal: "vendor" | "client";
  user: AuthUser | null;
  bookingUnread: number | null;
  chatUnread: number | null;
  vendorBookingsPending: number | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navItems.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        const showBookingBadge =
          portal === "client" &&
          Boolean(user) &&
          item.href === "/client/bookings" &&
          bookingUnread != null &&
          bookingUnread > 0;
        const showVendorBookingsBadge =
          portal === "vendor" &&
          Boolean(user) &&
          item.href === "/vendor/bookings" &&
          vendorBookingsPending != null &&
          vendorBookingsPending > 0;
        const showChatBadge =
          Boolean(user) &&
          item.href === (portal === "client" ? "/client/messages" : "/vendor/messages") &&
          chatUnread != null &&
          chatUnread > 0;
        const badgeCount = showBookingBadge
          ? bookingUnread!
          : showVendorBookingsBadge
            ? vendorBookingsPending!
            : showChatBadge
              ? chatUnread!
              : 0;
        const showBadge = showBookingBadge || showVendorBookingsBadge || showChatBadge;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 ease-out ${
              active
                ? "bg-primary/10 text-primary"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] shrink-0 transition ${
                active ? "text-primary" : "text-neutral-400 group-hover:text-neutral-600"
              }`}
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {showBadge ? (
              <span
                className={`min-w-[1.25rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${
                  active ? "bg-primary text-white" : "bg-primary/90 text-white"
                }`}
                aria-label={
                  showBookingBadge
                    ? `${badgeCount} unread booking updates`
                    : showVendorBookingsBadge
                      ? `${badgeCount} pending booking request${badgeCount === 1 ? "" : "s"}`
                      : `${badgeCount} unread messages`
                }
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

function UserFooter({
  email,
  roleFallback,
  onSignOut,
}: {
  email: string | null | undefined;
  roleFallback: string;
  onSignOut: () => void;
}) {
  const initial = (email?.trim()?.[0] ?? roleFallback[0] ?? "?").toUpperCase();

  return (
    <div className="shrink-0 border-t border-neutral-200/70 pt-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center gap-3 px-1">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{email ?? roleFallback}</p>
          <p className="truncate text-xs text-neutral-500">{roleFallback}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function PortalShell({
  title,
  children,
  portal = "vendor",
}: PortalShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navKey = `${pathname}?${searchParams.toString()}`;
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [bookingUnread, setBookingUnread] = useState<number | null>(null);
  const [chatUnread, setChatUnread] = useState<number | null>(null);
  const [vendorBookingsPending, setVendorBookingsPending] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refreshUnreadCounts = async () => {
    if (!user?.id) return;
    try {
      if (portal === "client") {
        const [bookingNotificationsUnread, chatMessagesUnread] = await Promise.all([
          fetchClientBookingNotificationsUnreadCount(),
          fetchChatUnreadCount(),
        ]);
        setBookingUnread(bookingNotificationsUnread);
        setChatUnread(chatMessagesUnread);
        setVendorBookingsPending(null);
      } else {
        const [chatMessagesUnread, activeBookings] = await Promise.all([
          fetchChatUnreadCount(),
          fetchVendorBookings("active"),
        ]);
        setChatUnread(chatMessagesUnread);
        setBookingUnread(null);
        setVendorBookingsPending(activeBookings.filter((b) => b.status === "pending").length);
      }
    } catch {
      setBookingUnread(portal === "client" ? 0 : null);
      setChatUnread(0);
      setVendorBookingsPending(portal === "vendor" ? 0 : null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await refreshUnreadCounts();
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, user?.id, navKey]);

  useEffect(() => {
    return installVisibilityRefresh(() => {
      void refreshUnreadCounts();
    });
  }, [portal, user?.id]);

  useEffect(() => {
    const onBookingCleared = () => setBookingUnread(0);
    window.addEventListener(BOOKING_NOTIFICATIONS_CLEARED_EVENT, onBookingCleared);
    return () => window.removeEventListener(BOOKING_NOTIFICATIONS_CLEARED_EVENT, onBookingCleared);
  }, []);

  useEffect(() => {
    const onChatUnreadCleared = () => {
      void refreshUnreadCounts();
    };
    window.addEventListener(CHAT_UNREAD_CLEARED_EVENT, onChatUnreadCleared);
    return () => window.removeEventListener(CHAT_UNREAD_CLEARED_EVENT, onChatUnreadCleared);
  }, [portal, user?.id]);

  useRealtimeRefresh(
    ["chat:unread_refresh", "booking_notifications:refresh", "bookings:refresh"],
    () => {
      void refreshUnreadCounts();
    },
    [portal, user?.id],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const logoHref = pathname.startsWith("/client")
    ? "/client/dashboard"
    : "/vendor/dashboard";
  const navItems = portal === "client" ? CLIENT_NAV : VENDOR_NAV;
  const roleFallback = portal === "client" ? "Client" : "Vendor";

  const closeMobile = () => setMobileNavOpen(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
      setSignOutOpen(false);
    }
  };

  const bellUnreadCount =
    portal === "client"
      ? (bookingUnread ?? 0) + (chatUnread ?? 0)
      : (vendorBookingsPending ?? 0) + (chatUnread ?? 0);

  const notificationBell = user ? (
    <NotificationBell portal={portal} unreadCount={bellUnreadCount} onMarkedRead={refreshUnreadCounts} />
  ) : null;

  const navProps = {
    navItems,
    pathname,
    portal,
    user,
    bookingUnread,
    chatUnread,
    vendorBookingsPending,
  } as const;

  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <ConfirmDialog
        isOpen={signOutOpen}
        title="Sign out?"
        description="You'll need to sign in again to access your account."
        confirmLabel="Sign out"
        confirmLoadingLabel="Signing out…"
        confirmVariant="destructive"
        loading={signingOut}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => void handleSignOut()}
      />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-neutral-200/60 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <EventtzLogo variant="sidebar" priority href={logoHref} className="min-w-0 shrink" />
        <div className="flex shrink-0 items-center gap-1.5">
          {notificationBell}
          <button
            type="button"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 transition hover:bg-neutral-200/80"
          >
            {mobileNavOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className="absolute right-0 top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col bg-white p-5 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <div onClick={closeMobile}>
                <EventtzLogo variant="sidebar" href={logoHref} />
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Close menu"
                onClick={closeMobile}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              <ShellNavLinks {...navProps} onNavigate={closeMobile} />
            </nav>
            <UserFooter
              email={user?.email}
              roleFallback={roleFallback}
              onSignOut={() => {
                closeMobile();
                setSignOutOpen(true);
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[248px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh max-h-dvh flex-col border-r border-neutral-200/60 bg-white/70 px-4 py-5 backdrop-blur-xl md:flex md:px-5">
          <div className="shrink-0 px-1">
            <EventtzLogo variant="sidebar" priority href={logoHref} />
          </div>

          <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            <ShellNavLinks {...navProps} />
          </nav>

          <UserFooter
            email={user?.email}
            roleFallback={roleFallback}
            onSignOut={() => setSignOutOpen(true)}
          />
        </aside>

        <main className="h-full min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="flex items-center justify-between gap-3">
              {title ? (
                <h1 className="min-w-0 break-words font-heading text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  {title}
                </h1>
              ) : (
                <span className="min-w-0" />
              )}
              <div className="hidden shrink-0 md:block">{notificationBell}</div>
            </div>
            <div className={`min-w-0 flex-1 ${title ? "mt-5 sm:mt-6" : "mt-3"}`}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
