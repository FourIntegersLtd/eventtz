"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/foundation/session";

/** One entry in a portal's navigation: where it links and what it says. */
export interface PortalNavItem {
  href: string;
  label: string;
}

/**
 * Everything a portal tells the shell about itself, so one component serves
 * both the client and the vendor portal.
 *
 * Every role-specific decision arrives as data or as a pure function of the
 * pathname, so the shell never learns which portal mounted it. The nav items
 * come precomputed because the vendor portal hides some from a vendor who is
 * not yet live-approved.
 */
export interface PortalShellProps {
  children: ReactNode;
  /** The logo's target, and the pathname to fall back on when `usePathname()` has none. */
  homeHref: string;
  /** Nav entries to draw, in order, already filtered for this caller. */
  items: readonly PortalNavItem[];
  /** Whether `href` is the page the user is on — each portal defines "active" for itself. */
  isNavActive: (pathname: string, href: string) => boolean;
  /** Header title for `pathname`, or `""` for no title. */
  pageTitle: (pathname: string) => string;
  /** True when the title must be hidden on mobile: master-detail routes carry their own back link. */
  hidePageTitleOnMobile: (pathname: string) => boolean;
}

/**
 * The chrome every signed-in portal page sits inside: a side nav on desktop
 * and a hamburger drawer holding the full nav on mobile, plus a header with
 * the page title and a sign out action. Ported from the baseline's
 * `PortalShell`. The drawer uses inline SVGs instead of the baseline's
 * `lucide-react` icons — `web/` has no icon library dependency yet.
 *
 * It lives in `surfaces/` because it is page chrome shared by two product
 * areas: the boundaries config forbids a domain importing another domain, and
 * it reserves `surfaces/` for the portal shells. Each portal's
 * `(portal)/layout.tsx` mounts it and passes that portal's own nav, title and
 * active-link rules, so neither domain needs to know the other exists.
 */
export function PortalShell({
  children,
  homeHref,
  items,
  isNavActive,
  pageTitle,
  hidePageTitleOnMobile,
}: PortalShellProps) {
  const pathname = usePathname() ?? homeHref;
  const router = useRouter();
  const { session, signOut } = useSession();
  const title = pageTitle(pathname);
  const hideTitleOnMobile = hidePageTitleOnMobile(pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Lock page scroll while the mobile drawer is open, like the baseline does.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page-bg md:flex-row">
      <nav className="hidden w-64 shrink-0 flex-col border-r border-primary-border bg-white px-4 py-6 md:flex">
        <Link href={homeHref} className="mb-8 px-2 text-lg font-bold text-primary">
          Eventtz
        </Link>
        <ul className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
                className={clsx(
                  "block rounded-xl px-3 py-2 text-sm font-medium transition",
                  isNavActive(pathname, item.href)
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

      <header className="z-30 flex items-center justify-between border-b border-primary-border bg-white px-4 py-3 md:hidden">
        <Link href={homeHref} className="text-lg font-bold text-primary">
          Eventtz
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeMobileNav}
          />
          <nav className="absolute right-0 top-0 flex h-dvh w-[min(20rem,calc(100vw-2.5rem))] max-w-full flex-col bg-white p-5 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between">
              <span className="text-lg font-bold text-primary">Eventtz</span>
              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-100"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <ul className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobileNav}
                    aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
                    className={clsx(
                      "block rounded-xl px-3 py-2 text-sm font-medium transition",
                      isNavActive(pathname, item.href)
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
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {title ? (
          <header className={clsx("border-b border-primary-border bg-white px-4 py-4 md:px-8", hideTitleOnMobile && "hidden md:block")}>
            <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
          </header>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
