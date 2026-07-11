"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Shield,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { Button } from "@/components/ui/Button";
import {
  adminPageBg,
  adminSidebarActive,
  adminSidebarIdle,
} from "@/features/admin/adminTheme";

const ADMIN_NAV: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/commerce?tab=bookings", label: "Commerce", icon: Receipt },
  { href: "/admin/directory?tab=vendors", label: "Directory", icon: Users },
  { href: "/admin/trust?tab=disputes", label: "Trust & safety", icon: Shield },
  { href: "/admin/team", label: "Team", icon: UserCog },
  { href: "/admin/audit", label: "Activity log", icon: ScrollText },
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
  if (itemHref.startsWith("/admin/trust")) {
    return pathname === "/admin/trust" || pathname.startsWith("/admin/trust/");
  }
  if (itemHref.startsWith("/admin/audit")) {
    return pathname === "/admin/audit" || pathname.startsWith("/admin/audit/");
  }
  if (itemHref.startsWith("/admin/team")) {
    return pathname === "/admin/team" || pathname.startsWith("/admin/team/");
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

function userInitial(email: string | null | undefined): string {
  const c = email?.trim()?.[0]?.toUpperCase();
  return c ?? "A";
}

type AdminShellProps = {
  title: string;
  children: ReactNode;
};

function NavLinks({
  pathname,
  onNavigate,
  items,
}: {
  pathname: string;
  onNavigate?: () => void;
  items: readonly { href: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <>
      {items.map((item) => {
        const active = navItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-r-lg px-3 py-2 text-sm transition ${active ? adminSidebarActive : adminSidebarIdle}`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function AdminUserFooter({
  email,
  onSignOut,
}: {
  email: string | null | undefined;
  onSignOut: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-neutral-200/80 pt-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
          {userInitial(email)}
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-neutral-600">{email ?? "—"}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start gap-2 px-2"
        icon={<LogOut className="h-4 w-4" aria-hidden />}
        onClick={onSignOut}
      >
        Sign out
      </Button>
    </div>
  );
}

export function AdminShell({ title, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    router.replace("/admin/login");
  };

  return (
    <div className={`app-viewport-shell w-full min-w-0 overflow-x-hidden ${adminPageBg} text-neutral-900`}>
      <header className="app-viewport-shell__mobile-nav z-30 flex items-center justify-between gap-3 border-b border-neutral-200/80 bg-neutral-50/95 px-3 backdrop-blur-md md:hidden">
        <EventtzLogo variant="sidebar" priority href="/admin/dashboard" className="min-w-0 shrink" />
        <button
          type="button"
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileNavOpen((o) => !o)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 shadow-sm"
        >
          {mobileNavOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </header>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside
            className={`absolute right-0 top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-2rem))] max-w-full flex-col border-l border-neutral-200 bg-white p-4 shadow-xl ${adminPageBg}`}
          >
            <div className="flex shrink-0 items-start justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-800">Admin</p>
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                aria-label="Close menu"
                onClick={closeMobile}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 flex min-h-0 flex-1 flex-col space-y-0.5 overflow-y-auto">
              <NavLinks pathname={pathname} onNavigate={closeMobile} items={ADMIN_NAV} />
            </nav>
            <AdminUserFooter
              email={user?.email}
              onSignOut={() => {
                closeMobile();
                void signOutAdmin();
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="app-viewport-shell__body w-full min-w-0 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`app-viewport-shell__sidebar border-r border-neutral-200/80 bg-white p-5 ${adminPageBg}`}>
          <div className="shrink-0">
            <EventtzLogo variant="sidebar" priority href="/admin/dashboard" />
            <p className="mt-1 text-xs font-medium text-neutral-500">Admin console</p>
          </div>
          <nav className="scroll-pane mt-6 flex min-h-0 flex-1 flex-col space-y-0.5">
            <NavLinks pathname={pathname} items={ADMIN_NAV} />
          </nav>
          <AdminUserFooter email={user?.email} onSignOut={() => void signOutAdmin()} />
        </aside>

        <main className="app-viewport-shell__main overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
          <h1 className="shrink-0 break-words font-heading text-xl font-semibold text-neutral-900 sm:text-2xl">
            {title}
          </h1>
          <div className="app-viewport-shell__main-scroll scroll-pane mt-4 min-w-0 sm:mt-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
