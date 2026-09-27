"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/foundation/session";
import {
  isVendorNavActive,
  vendorHidePageTitleOnMobile,
  vendorNavItems,
  vendorPortalPageTitle,
} from "@/domains/vendor-shell/portalNav";

/**
 * The chrome every signed-in vendor page sits inside: a side nav on desktop,
 * a bottom tab bar on mobile, and a header with the page title and a sign
 * out action. Ported from the baseline's `PortalShell`, vendor-only.
 */
export function PortalShell({ children, preApproval = false }: { children: ReactNode; preApproval?: boolean }) {
  const pathname = usePathname() ?? "/vendor/dashboard";
  const router = useRouter();
  const { session, signOut } = useSession();
  const items = vendorNavItems({ preApproval });
  const title = vendorPortalPageTitle(pathname);
  const hideTitleOnMobile = vendorHidePageTitleOnMobile(pathname);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page-bg md:flex-row">
      <nav className="hidden w-64 shrink-0 flex-col border-r border-primary-border bg-white px-4 py-6 md:flex">
        <Link href="/vendor/dashboard" className="mb-8 px-2 text-lg font-bold text-primary">
          Eventtz
        </Link>
        <ul className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-xl px-3 py-2 text-sm font-medium transition",
                  isVendorNavActive(pathname, item.href)
                    ? "bg-primary-soft text-primary"
                    : "text-neutral-600 hover:bg-primary-soft/60",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-primary-border pt-4 text-sm">
          <p className="truncate font-medium text-neutral-900">{session?.user.preferred_name ?? session?.user.email}</p>
          <button type="button" onClick={handleSignOut} className="mt-2 text-primary hover:underline">
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {title ? (
          <header className={clsx("border-b border-primary-border bg-white px-4 py-4 md:px-8", hideTitleOnMobile && "hidden md:block")}>
            <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
          </header>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-primary-border bg-white md:hidden">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex-1 py-2.5 text-center text-xs font-medium",
              isVendorNavActive(pathname, item.href) ? "text-primary" : "text-neutral-500",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
