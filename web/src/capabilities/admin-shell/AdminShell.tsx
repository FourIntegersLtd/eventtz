"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/foundation/ui";
import { RequireCapability, RequireSession, useSession } from "@/foundation/session";
import { loginHref } from "@/foundation/session/loginHref";
import { ADMIN_NAV } from "@/capabilities/admin-shell/nav";
import { isSuperAdmin } from "@/capabilities/admin-shell/permissions";

/**
 * The admin console's shell: sidebar nav, header title, sign-out.
 *
 * Ported from `frontend/components/admin-shell/AdminShell.tsx`, simplified to
 * a single always-visible sidebar (no slide-over drawer) since `web` has no
 * icon library yet — the baseline's mobile hamburger menu is left for a
 * later pass. Every admin `page.tsx` wraps its view in `<AdminShell title="...">`.
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

function ShellChrome({ title, children }: { title: string; children: ReactNode }) {
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const superAdmin = isSuperAdmin(session);
  const visibleNav = ADMIN_NAV.filter((item) => !item.superAdminOnly || superAdmin);

  async function handleSignOut() {
    await signOut();
    router.replace(loginHref("/admin/dashboard", false));
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-primary-border bg-white p-4 md:flex md:flex-col">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin console</p>
          <p className="text-xs text-neutral-500">{superAdmin ? "Super admin" : "Support admin"}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
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
        </nav>
        <div className="mt-4 border-t border-primary-border pt-4">
          <p className="truncate text-sm font-medium text-neutral-900">{session?.user.email ?? ""}</p>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex flex-col">
        <header className="border-b border-primary-border bg-white px-4 py-4 md:px-8">
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
