"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/foundation/ui";
import { RequireCapability, RequireSession, useSession } from "@/foundation/session";
import { loginHref } from "@/foundation/session/loginHref";
import type { AdminNavItem } from "@/capabilities/admin-shell/nav";
import { visibleAdminNavItems } from "@/capabilities/admin-shell/navVisibility";
import { isSuperAdmin } from "@/capabilities/admin-shell/permissions";

/**
 * The admin console's shell: sidebar nav, header title, sign-out.
 *
 * Desktop sidebar matches `frontend/components/admin-shell/AdminShell.tsx`; below
 * `md`, a slide-over menu exposes the same `visibleNav` links.
 */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <RequireSession>
      <RequireCapability permission="access_admin_portal">
        <ShellChrome title={title}>{children}</ShellChrome>
      </RequireCapability>
    </RequireSession>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-neutral-800">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="text-neutral-800">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AdminNavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: AdminNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              active
                ? "block rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary"
                : "block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-primary-soft"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function ShellChrome({ title, children }: { title: string; children: ReactNode }) {
  const { session, signOut } = useSession();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const superAdmin = isSuperAdmin(session);
  const visibleNav = visibleAdminNavItems(superAdmin);
  const [mobileNav, setMobileNav] = useState({ open: false, path: "" });
  const mobileNavOpen = mobileNav.open && mobileNav.path === pathname;

  const openMobile = () => setMobileNav({ open: true, path: pathname });
  const closeMobile = () => setMobileNav({ open: false, path: pathname });

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  async function handleSignOut() {
    closeMobile();
    await signOut();
    router.replace(loginHref("/admin/dashboard", false));
  }

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <header className="z-30 flex items-center justify-between gap-3 border-b border-primary-border bg-white px-3 py-2 md:hidden">
        <h1 className="truncate text-sm font-semibold text-neutral-900">{title}</h1>
        <button
          type="button"
          aria-expanded={mobileNavOpen}
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          onClick={() => (mobileNavOpen ? closeMobile() : openMobile())}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-white shadow-sm"
        >
          {mobileNavOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={closeMobile} />
          <aside
            className="absolute right-0 top-0 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col border-l border-primary-border bg-white p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-neutral-800">Admin console</p>
                <p className="text-xs text-neutral-500">{superAdmin ? "Super admin" : "Support admin"}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
                aria-label="Close menu"
                onClick={closeMobile}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="mt-4 flex min-h-0 flex-1 flex-col space-y-1 overflow-y-auto">
              <AdminNavLinks items={visibleNav} pathname={pathname} onNavigate={closeMobile} />
            </nav>
            <div className="mt-4 border-t border-primary-border pt-4">
              <p className="truncate text-sm font-medium text-neutral-900">{session?.user.email ?? ""}</p>
              <Button variant="secondary" className="mt-2 w-full" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-primary-border bg-white p-4 md:flex md:flex-col">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin console</p>
            <p className="text-xs text-neutral-500">{superAdmin ? "Super admin" : "Support admin"}</p>
          </div>
          <nav className="flex-1 space-y-1">
            <AdminNavLinks items={visibleNav} pathname={pathname} />
          </nav>
          <div className="mt-4 border-t border-primary-border pt-4">
            <p className="truncate text-sm font-medium text-neutral-900">{session?.user.email ?? ""}</p>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </aside>
        <div className="flex flex-col">
          <header className="hidden border-b border-primary-border bg-white px-4 py-4 md:block md:px-8">
            <h1 className="text-lg font-semibold text-neutral-900 md:block">{title}</h1>
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
