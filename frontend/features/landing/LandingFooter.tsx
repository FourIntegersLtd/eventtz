"use client";

import Link from "next/link";
import {
  CREATE_ACCOUNT_LINK,
  REGISTER_LINK,
  SOCIAL_LINKS,
  WAITLIST_URL,
} from "@/features/landing/landingData";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_CONTACT_EMAIL,
  FOOTER_LEGAL_LINKS,
} from "@/lib/footerLinks";

const SOCIAL_ICON_CLASS =
  "flex h-10 w-10 items-center justify-center rounded-lg border border-primary-border bg-white text-neutral-700 transition-all hover:scale-105 hover:border-primary/30 hover:bg-primary-muted hover:text-primary";

const FOOTER_LINK_CLASS = "text-neutral-600 transition-colors hover:text-primary";

type LandingFooterProps = {
  className?: string;
  /** Use `""` on the home page (`#faq`); use `"/"` on other routes (`/#faq`). */
  sectionLinkPrefix?: "" | "/";
};

export function LandingFooter({
  className = "",
  sectionLinkPrefix = "",
}: LandingFooterProps) {
  const browseHref = `${sectionLinkPrefix}#browse`;
  const featuredHref = `${sectionLinkPrefix}#featured`;
  const forVendorsHref = `${sectionLinkPrefix}#for-vendors`;
  const howItWorksHref = `${sectionLinkPrefix}#how-it-works`;
  const faqHref = `${sectionLinkPrefix}#faq`;
  const reviewsHref = `${sectionLinkPrefix}#reviews`;

  return (
    <footer
      className={`border-t border-primary-border/60 bg-primary-soft/40 ${className}`.trim()}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 gap-12 sm:gap-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Follow us
              </h4>
              <div className="flex flex-wrap gap-3">
                {SOCIAL_LINKS.map(({ name, href, aria, Icon }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={SOCIAL_ICON_CLASS}
                    aria-label={aria}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Address
              </h4>
              <p className="text-sm leading-relaxed text-neutral-600">
                {FOOTER_ADDRESS_LINES.map((line, index) => (
                  <span key={line}>
                    {line}
                    {index < FOOTER_ADDRESS_LINES.length - 1 ? <br /> : null}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4">
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Marketplace
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/explore" className={FOOTER_LINK_CLASS}>
                    Explore vendors
                  </Link>
                </li>
                <li>
                  <Link href={browseHref} className={FOOTER_LINK_CLASS}>
                    Browse categories
                  </Link>
                </li>
                <li>
                  <Link href={featuredHref} className={FOOTER_LINK_CLASS}>
                    Featured vendors
                  </Link>
                </li>
                <li>
                  <Link href={forVendorsHref} className={FOOTER_LINK_CLASS}>
                    For vendors
                  </Link>
                </li>
                <li>
                  <Link href={REGISTER_LINK.href} className={FOOTER_LINK_CLASS}>
                    {REGISTER_LINK.label}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Account
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href="/login" className={FOOTER_LINK_CLASS}>
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href={CREATE_ACCOUNT_LINK.href} className={FOOTER_LINK_CLASS}>
                    {CREATE_ACCOUNT_LINK.label}
                  </Link>
                </li>
                <li>
                  <Link href="/register?type=vendor" className={FOOTER_LINK_CLASS}>
                    Register as a vendor
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Resources
              </h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link href={howItWorksHref} className={FOOTER_LINK_CLASS}>
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href={reviewsHref} className={FOOTER_LINK_CLASS}>
                    Reviews
                  </Link>
                </li>
                <li>
                  <Link href={faqHref} className={FOOTER_LINK_CLASS}>
                    FAQs
                  </Link>
                </li>
                <li>
                  <a
                    href={`mailto:${FOOTER_CONTACT_EMAIL}`}
                    className={FOOTER_LINK_CLASS}
                  >
                    Contact us
                  </a>
                </li>
                <li>
                  <a
                    href={WAITLIST_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={FOOTER_LINK_CLASS}
                  >
                    Join waitlist
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Legal
              </h4>
              <ul className="space-y-3 text-sm">
                {FOOTER_LEGAL_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className={FOOTER_LINK_CLASS}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-4 sm:mt-16">
          <p className="text-center text-sm text-neutral-600">
            © {new Date().getFullYear()} Four Integers Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
