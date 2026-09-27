import Link from "next/link";
import type { ReactNode } from "react";
import { FOOTER_ADDRESS_LINES, FOOTER_CONTACT_EMAIL, FOOTER_LEGAL_LINKS } from "@/domains/marketing/constants";

/**
 * The shared chrome for every `(marketing)` page: a nav bar with sign-in/register
 * links, the page content, and a footer with legal links and company details.
 *
 * Ported (simplified) from the baseline's `LandingNav` + `LandingFooter`. The
 * baseline nav is a scroll-aware, section-jumping bar built for the full
 * `LandingMarketplace` hero; that hero (video, vendor carousels, animated
 * counters) needs packages this workstream is not approved to install (see
 * the final report) and belongs to the browse/marketplace workstream. This
 * shell keeps the same links and URLs without that presentation layer.
 */
export function MarketingShell({
  children,
  width,
}: {
  children: ReactNode;
  /**
   * Browse list (`wide`, max-w-7xl) or vendor detail (`detail`, max-w-[90rem]).
   * Omitted on marketing pages, which keep today's unframed main.
   * Top padding is smaller than the baseline overlay offset because this header
   * sits in normal document flow.
   */
  width?: "wide" | "detail";
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page-bg text-neutral-900">
      <header className="sticky top-0 z-40 border-b border-primary-border/50 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="font-heading text-lg font-semibold text-primary">
            Eventtz
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-neutral-700">
            <Link href="/blog" className="transition hover:text-primary">
              Blog
            </Link>
            <Link href="/login" className="transition hover:text-primary">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-primary px-3 py-1.5 text-white transition hover:opacity-90"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {width == null ? (
          children
        ) : (
          <div
            className={`mx-auto w-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 ${
              width === "detail" ? "max-w-[90rem] pt-6 sm:pt-8" : "max-w-7xl pt-6 sm:pt-8"
            }`}
          >
            {children}
          </div>
        )}
      </main>

      <footer className="border-t border-primary-border/60 bg-primary-soft/40">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 text-sm text-neutral-600 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Eventtz</h2>
            <p>{FOOTER_ADDRESS_LINES.join(", ")}</p>
            <p className="mt-2">
              <a href={`mailto:${FOOTER_CONTACT_EMAIL}`} className="hover:text-primary">
                {FOOTER_CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Legal</h2>
            <ul className="space-y-2">
              {FOOTER_LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Account</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="hover:text-primary">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary">
                  Create account
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
