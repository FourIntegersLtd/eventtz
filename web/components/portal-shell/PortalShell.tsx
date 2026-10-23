"use client";

import Link from "next/link";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
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
import { fetchVendorDashboard } from "@/lib/portalDashboardApi";
import { fetchVendorProfile } from "@/lib/vendorProfileApi";
import { vendorIsLiveApproved } from "@/lib/vendorAccess";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { HelpWidget } from "@/features/help/HelpWidget";
import { VendorCopilotProvider } from "@/features/vendor/copilot/VendorCopilotContext";
import { VendorCopilotWidget } from "@/features/vendor/copilot/VendorCopilotWidget";
import type { PortalRole } from "@/lib/portalRole";
import { TermsUpdateBanner } from "@/components/portal-shell/TermsUpdateBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  isPortalNavActive,
  portalDashboardHref,
  portalNavItems,
} from "@/components/portal-shell/portalNav";

/**
 * The signed-in client and vendor shell, transcribed from the canvas `Shells` artboard:
 * an `ez-side` sidebar (logo, role chip, nav, user chip) beside an `ez-main` column with an
 * `ez-topbar--icon` (notifications bell) over `ez-content`; page titles are in-page. The `app-viewport-shell` classes keep
 * the shell locked to the viewport so master-detail pages scroll inside their panes; the
 * `ez-` classes from `design/canvas/project/eventtz.css` give it the drawn look.
 */
export type PortalShellProps = {
  title: string;
  children: ReactNode;
  /** Client accounts use client routes only - no vendor onboarding/profile in the sidebar. */
  portal?: PortalRole;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Sidebar and drawer nav links with the unread and pending badges each portal shows. */
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
  portal: PortalRole;
  user: AuthUser | null;
  bookingUnread: number | null;
  chatUnread: number | null;
  vendorBookingsPending: number | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navItems.map((item) => {
        const active = isPortalNavActive(pathname, item.href);
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
          item.href === (portal === "client" ? "/client/help" : "/vendor/help") &&
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
            className={
              active
                ? `ez-nav-item ez-nav-item--active${item.href === "/client/planner" ? " ez-nav-item--feature" : ""}`
                : `ez-nav-item${item.href === "/client/planner" ? " ez-nav-item--feature" : ""}`
            }
          >
            <Icon size={19} strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {showBadge ? (
              <span
                className="ez-nav-item__count"
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

/** Two-letter initials for the user chip: from the preferred name, else the email's first letter. */
function userInitials(user: AuthUser | null, roleFallback: string): string {
  const name = user?.preferred_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name[0].toUpperCase();
  }
  return (user?.email?.trim()?.[0] ?? roleFallback[0] ?? "?").toUpperCase();
}

/**
 * The user chip at the foot of the sidebar or drawer: avatar initials, name, status line and
 * sign out. The desktop sidebar passes `ez-side__foot`; the drawer must not, because eventtz.css
 * hides `.ez-side__foot` below 720px and the drawer only exists there.
 */
function UserFooter({
  user,
  roleFallback,
  statusLine,
  onSignOut,
  className,
}: {
  user: AuthUser | null;
  roleFallback: string;
  statusLine: string;
  onSignOut: () => void;
  className: string;
}) {
  const displayName = user?.preferred_name?.trim() || user?.email || roleFallback;
  return (
    <div className={`${className} shrink-0 pb-[env(safe-area-inset-bottom,0px)]`}>
      <div className="ez-side__user">
        <span className="ez-avatar ez-avatar--sm" aria-hidden>
          {userInitials(user, roleFallback)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="ez-strong truncate" style={{ fontSize: 14 }}>
            {displayName}
          </div>
          <div className="ez-caption truncate">{statusLine}</div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="ez-icon-btn shrink-0"
          style={{ width: 36, height: 36 }}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function PortalShell({
  title: _title,
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
  const [vendorPreApproval, setVendorPreApproval] = useState(portal === "vendor");
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
        setVendorPreApproval(false);
      } else {
        const [chatMessagesUnread, profile] = await Promise.all([
          fetchChatUnreadCount(),
          fetchVendorProfile().catch(() => null),
        ]);
        const live = profile != null && vendorIsLiveApproved(profile);
        setVendorPreApproval(!live);
        setChatUnread(chatMessagesUnread);
        setBookingUnread(null);
        if (!live) {
          setVendorBookingsPending(0);
          return;
        }
        const dashboard = await fetchVendorDashboard();
        setVendorBookingsPending(dashboard.pending_bookings_count);
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

  const logoHref = portalDashboardHref(portal);
  const navItems = portalNavItems(portal, {
    vendorPreApproval: portal === "vendor" && vendorPreApproval,
  });
  const roleFallback = portal === "client" ? "Client" : "Vendor";
  // The chip's second line is the account's state: a vendor still in review sees that, not their role.
  const statusLine = portal === "vendor" && vendorPreApproval ? "Pending review" : roleFallback;

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
    <NotificationBell
      portal={portal}
      unreadCount={bellUnreadCount}
      onMarkedRead={refreshUnreadCounts}
      viewAllHref={
        portal === "vendor" && vendorPreApproval ? "/vendor/help" : undefined
      }
      viewAllLabel={
        portal === "vendor" && vendorPreApproval ? "Open Help" : undefined
      }
    />
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

  const shell = (
    <div className="app-viewport-shell ez-shell ez-page w-full min-w-0 overflow-x-hidden">
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

      {/* Mobile top bar - fixed height; page scroll is in main only. The wrapper carries
          md:hidden because eventtz.css is unlayered, so `hidden` cannot beat `.ez-topbar`. */}
      <div className="z-30 shrink-0 md:hidden">
        <header className="app-viewport-shell__mobile-nav ez-topbar">
          <EventtzLogo priority href={logoHref} imageClassName="ez-logo ez-logo--sm" className="min-w-0 shrink" />
          <div className="ez-topbar__actions shrink-0">
            {notificationBell}
            <button
              type="button"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((open) => !open)}
              className="ez-icon-btn ez-icon-btn--outline"
            >
              {mobileNavOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </header>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-scrim"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          {/* Plain Tailwind here: eventtz.css turns `.ez-side` into a row and hides its brand
              and foot below 720px, which is exactly where the drawer lives. */}
          <aside className="absolute right-0 top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col gap-1 bg-white px-[14px] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-overlay">
            <div className="mb-3 flex items-center justify-end">
              <button
                type="button"
                className="ez-icon-btn"
                aria-label="Close menu"
                onClick={closeMobile}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <nav className="scroll-pane flex min-h-0 flex-1 flex-col gap-1">
              <ShellNavLinks {...navProps} onNavigate={closeMobile} />
            </nav>
            <UserFooter
              user={user}
              roleFallback={roleFallback}
              statusLine={statusLine}
              onSignOut={() => {
                closeMobile();
                setSignOutOpen(true);
              }}
              className="mt-auto border-t border-line pt-3"
            />
          </aside>
        </div>
      ) : null}

      <div className="app-viewport-shell__body w-full min-w-0 md:grid-cols-[248px_minmax(0,1fr)]">
        {/* Desktop sidebar - fixed column height; nav scrolls inside */}
        <nav className="app-viewport-shell__sidebar ez-side" aria-label={`${roleFallback} navigation`}>
          <div className="ez-side__brand shrink-0">
            <EventtzLogo priority href={logoHref} imageClassName="ez-logo ez-logo--sm" />
            <span className={`ez-role ez-role--${portal}`}>{roleFallback}</span>
          </div>

          <div className="scroll-pane flex min-h-0 flex-1 flex-col gap-1">
            <ShellNavLinks {...navProps} />
          </div>

          <UserFooter
            user={user}
            roleFallback={roleFallback}
            statusLine={statusLine}
            onSignOut={() => setSignOutOpen(true)}
            className="ez-side__foot"
          />
        </nav>

        <main className="app-viewport-shell__main ez-main overflow-x-hidden">
          {/* Desktop: bell only (same as vendor). Page titles live in `ez-pagehead` inside content. */}
          <div className="hidden shrink-0 md:block">
            <header className="ez-topbar ez-topbar--icon">
              <div className="ez-topbar__actions">{notificationBell}</div>
            </header>
          </div>
          <div className="portal-content app-viewport-shell__main-scroll ez-content min-w-0">
            <TermsUpdateBanner />
            {children}
          </div>
        </main>
      </div>

      {portal === "vendor" ? null : <HelpWidget audience={portal} hidden={mobileNavOpen} />}
      {portal === "vendor" ? <VendorCopilotWidget /> : null}
    </div>
  );

  if (portal === "vendor") {
    return <VendorCopilotProvider>{shell}</VendorCopilotProvider>;
  }

  return shell;
}
