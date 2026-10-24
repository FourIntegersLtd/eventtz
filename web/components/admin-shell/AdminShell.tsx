"use client";

import Link from "next/link";
import {
  BookOpen,
  Bug,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginPathWithNext } from "@/features/auth/authRouting";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { resolveAdminRole, isSuperAdmin } from "@/lib/adminRole";
import { fetchAdminUnreadCount } from "@/lib/adminMessagesApi";
import { CHAT_UNREAD_CLEARED_EVENT } from "@/lib/chatApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import { HelpWidget } from "@/features/help/HelpWidget";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  id?: string;
  superAdminOnly?: boolean;
};

type AdminNavGroup = {
  label?: string;
  items: readonly AdminNavItem[];
};

/** Design order: Dashboard, Operate, Talk, then Blog and Referrals, then Run. */
const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operate",
    items: [
      { href: "/admin/commerce?tab=bookings", label: "Commerce", icon: Receipt },
      { href: "/admin/directory?tab=vendors", label: "Directory", icon: Users },
      { href: "/admin/trust?tab=disputes", label: "Trust and safety", icon: Shield },
    ],
  },
  {
    label: "Talk",
    items: [
      { href: "/admin/messages?tab=inbox", label: "Messages", icon: MessageSquare, id: "messages" },
    ],
  },
  {
    items: [
      { href: "/admin/blog", label: "Blog", icon: BookOpen },
      { href: "/admin/referrals", label: "Referrals", icon: Link2 },
    ],
  },
  {
    label: "Run",
    items: [
      { href: "/admin/team", label: "Team", icon: UserCog },
      { href: "/admin/audit", label: "Activity log", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/report-bug", label: "Report a bug", icon: Bug },
      { href: "/admin/email", label: "Email health", icon: Mail, superAdminOnly: true },
    ],
  },
];

function navItemActive(pathname: string, itemHref: string): boolean {
  if (itemHref.startsWith("/admin/dashboard")) {
    return pathname === "/admin/dashboard" || pathname.startsWith("/admin/dashboard/");
  }
  if (itemHref.startsWith("/admin/commerce")) {
    return (
      pathname === "/admin/commerce" ||
      pathname.startsWith("/admin/commerce/") ||
      pathname === "/admin/bookings" ||
      pathname.startsWith("/admin/bookings/")
    );
  }
  if (itemHref.startsWith("/admin/directory")) {
    return pathname === "/admin/directory" || pathname.startsWith("/admin/directory/");
  }
  if (itemHref.startsWith("/admin/referrals")) {
    return pathname === "/admin/referrals" || pathname.startsWith("/admin/referrals/");
  }
  if (itemHref.startsWith("/admin/trust")) {
    return pathname === "/admin/trust" || pathname.startsWith("/admin/trust/");
  }
  if (itemHref.startsWith("/admin/audit")) {
    return pathname === "/admin/audit" || pathname.startsWith("/admin/audit/");
  }
  if (itemHref.startsWith("/admin/settings")) {
    return pathname === "/admin/settings" || pathname.startsWith("/admin/settings/");
  }
  if (itemHref.startsWith("/admin/team")) {
    return pathname === "/admin/team" || pathname.startsWith("/admin/team/");
  }
  if (itemHref.startsWith("/admin/messages")) {
    return pathname === "/admin/messages" || pathname.startsWith("/admin/messages/");
  }
  if (itemHref.startsWith("/admin/report-bug")) {
    return pathname === "/admin/report-bug" || pathname.startsWith("/admin/report-bug/");
  }
  if (itemHref.startsWith("/admin/blog")) {
    return pathname === "/admin/blog" || pathname.startsWith("/admin/blog/");
  }
  if (itemHref.startsWith("/admin/email")) {
    return pathname === "/admin/email" || pathname.startsWith("/admin/email/");
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

function userInitial(email: string | null | undefined): string {
  const c = email?.trim()?.[0]?.toUpperCase();
  return c ?? "A";
}

type AdminShellProps = {
  children: ReactNode;
};

function NavGroups({
  pathname,
  onNavigate,
  groups,
  badges,
}: {
  pathname: string;
  onNavigate?: () => void;
  groups: readonly AdminNavGroup[];
  badges?: Record<string, number>;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label ?? group.items[0]?.href}>
          {group.label ? <div className="ez-side__group">{group.label}</div> : null}
          {group.items.map((item) => {
            const active = navItemActive(pathname, item.href);
            const Icon = item.icon;
            const badge = item.id && badges?.[item.id] ? badges[item.id]! : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={active ? "ez-nav-item ez-nav-item--active" : "ez-nav-item"}
              >
                <Icon size={19} strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge > 0 ? (
                  <span className="ez-nav-item__count" aria-label={`${badge} unread messages`}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

function AdminUserFooter({
  email,
  roleLabel,
  onSignOut,
  className,
}: {
  email: string | null | undefined;
  roleLabel: string;
  onSignOut: () => void;
  className: string;
}) {
  return (
    <div className={`${className} shrink-0 pb-[env(safe-area-inset-bottom,0px)]`}>
      <div className="ez-side__user">
        <span className="ez-avatar ez-avatar--sm" aria-hidden>
          {userInitial(email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="ez-strong truncate text-[14px]">
            {email ?? "Admin"}
          </div>
          <div className="ez-caption truncate">{roleLabel}</div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="ez-icon-btn h-9 w-9 shrink-0"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Signed-in admin shell, transcribed from the canvas admin artboards: `ez-shell--admin`
 * with grouped nav, a user chip, and `ez-content` (page titles use `PageHeader`).
 */
export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messagesUnread, setMessagesUnread] = useState(0);

  const refreshMessagesUnread = useCallback(async () => {
    try {
      setMessagesUnread(await fetchAdminUnreadCount());
    } catch {
      /* badge is best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshMessagesUnread();
  }, [refreshMessagesUnread, pathname]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshMessagesUnread();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshMessagesUnread]);

  useRealtimeRefresh("chat:data_refresh", () => void refreshMessagesUnread(), [
    refreshMessagesUnread,
  ]);

  useEffect(() => {
    const onCleared = () => void refreshMessagesUnread();
    window.addEventListener(CHAT_UNREAD_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(CHAT_UNREAD_CLEARED_EVENT, onCleared);
  }, [refreshMessagesUnread]);

  const navBadges = messagesUnread > 0 ? { messages: messagesUnread } : undefined;
  const navGroups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin(user)),
  })).filter((group) => group.items.length > 0);
  const roleLabel = user && resolveAdminRole(user) === "super_admin" ? "Super admin" : "Support admin";

  const closeMobile = () => setMobileNavOpen(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const signOutAdmin = async () => {
    await signOut();
    router.replace(loginPathWithNext("/admin/dashboard"));
  };

  return (
    <div className="app-viewport-shell ez-shell ez-shell--admin ez-page w-full min-w-0 overflow-x-hidden">
      <div className="z-30 shrink-0 md:hidden">
        <header className="app-viewport-shell__mobile-nav ez-topbar">
          <EventtzLogo priority href="/admin/dashboard" imageClassName="ez-logo ez-logo--sm" className="min-w-0 shrink" />
          <div className="ez-topbar__actions shrink-0">
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

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-scrim" aria-label="Close menu" onClick={closeMobile} />
          {/* Plain layout here: eventtz.css turns `.ez-side` into a row and hides groups below 720px. */}
          <aside className="absolute right-0 top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col gap-1 bg-white px-[14px] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-overlay">
            <div className="mb-3 flex items-center justify-between">
              <span className="ez-role ez-role--admin">Admin</span>
              <button type="button" className="ez-icon-btn" aria-label="Close menu" onClick={closeMobile}>
                <X size={20} aria-hidden />
              </button>
            </div>
            <nav className="scroll-pane flex min-h-0 flex-1 flex-col gap-1" aria-label="Admin navigation">
              <NavGroups pathname={pathname} onNavigate={closeMobile} groups={navGroups} badges={navBadges} />
            </nav>
            <AdminUserFooter
              email={user?.email}
              roleLabel={roleLabel}
              onSignOut={() => {
                closeMobile();
                void signOutAdmin();
              }}
              className="mt-auto border-t border-line pt-3"
            />
          </aside>
        </div>
      ) : null}

      <div className="app-viewport-shell__body w-full min-w-0 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="app-viewport-shell__sidebar ez-side" aria-label="Admin navigation">
          <div className="ez-side__brand shrink-0">
            <EventtzLogo priority href="/admin/dashboard" imageClassName="ez-logo ez-logo--sm" />
            <span className="ez-role ez-role--admin">Admin</span>
          </div>
          <div className="scroll-pane flex min-h-0 flex-1 flex-col">
            <NavGroups pathname={pathname} groups={navGroups} badges={navBadges} />
          </div>
          <AdminUserFooter
            email={user?.email}
            roleLabel={roleLabel}
            onSignOut={() => void signOutAdmin()}
            className="ez-side__foot"
          />
        </nav>

        <main className="app-viewport-shell__main ez-main overflow-x-hidden">
          <div className="portal-content app-viewport-shell__main-scroll ez-content ez-content--wide min-w-0">
            {children}
          </div>
        </main>
      </div>

      <HelpWidget audience="admin" hidden={mobileNavOpen} />
    </div>
  );
}
