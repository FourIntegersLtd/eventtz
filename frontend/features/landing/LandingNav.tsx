"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import {
  BROWSE_LINK,
  EXPLORE_NAV_LINKS,
  REGISTER_LINK,
  MOBILE_NAV_LINKS,
  NAV_DROPDOWN_LINK_CLASS,
  SIGN_IN_LINK,
} from "@/features/landing/landingData";
import { useLandingNavScroll } from "@/features/landing/useLandingNavScroll";

type NavLinkItemProps = {
  href: string;
  className: string;
  children: ReactNode;
  onClick?: () => void;
};

function NavLinkItem({ href, className, children, onClick }: NavLinkItemProps) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

type NavDropdownProps = {
  label: string;
  align?: "left" | "right";
  items: readonly { href: string; label: string }[];
  darkNav?: boolean;
};

function NavDropdown({ label, align = "right", items, darkNav = false }: NavDropdownProps) {
  const panelAlign = align === "left" ? "left-0" : "right-0";
  return (
    <div className="group relative z-10 hidden hover:z-[100] focus-within:z-[100] lg:block">
      <button
        type="button"
        className={
          darkNav
            ? "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
            : "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-primary"
        }
      >
        {label}
        <ChevronDown
          className="h-4 w-4 opacity-60 transition group-hover:rotate-180"
          strokeWidth={2}
        />
      </button>
      <div
        className={`pointer-events-none absolute top-full z-[80] w-52 pt-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 ${panelAlign}`}
      >
        <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-lg shadow-neutral-200/60">
          {items.map((item) => (
            <NavLinkItem
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={NAV_DROPDOWN_LINK_CLASS}
            >
              {item.label}
            </NavLinkItem>
          ))}
        </div>
      </div>
    </div>
  );
}

function withSectionPrefix(href: string, sectionLinkPrefix: "" | "/") {
  return href.startsWith("#") ? `${sectionLinkPrefix}${href}` : href;
}

type LandingNavProps = {
  /** Transparent over hero on home; always solid on inner pages (e.g. compliance). */
  variant?: "hero" | "solid";
  /** Prefix landing section anchors when not on `/` — e.g. `"/"` → `/#faq`. */
  sectionLinkPrefix?: "" | "/";
};

export function LandingNav({
  variant = "hero",
  sectionLinkPrefix = "",
}: LandingNavProps) {
  const scrollSolid = useLandingNavScroll();
  const navSolid = variant === "solid" || scrollSolid;
  const [mobileOpen, setMobileOpen] = useState(false);
  const darkNav = variant === "hero" && !navSolid;

  const exploreLinks = EXPLORE_NAV_LINKS.map((item) => ({
    ...item,
    href: withSectionPrefix(item.href, sectionLinkPrefix),
  }));

  const mobileLinks = MOBILE_NAV_LINKS.map((item) => ({
    ...item,
    href: withSectionPrefix(item.href, sectionLinkPrefix),
  }));

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const outlineCtaClass = darkNav
    ? "ml-1 inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
    : "ml-1 inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50";

  const primaryCtaClass = darkNav
    ? "ml-2 inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-neutral-900 transition hover:opacity-90"
    : "ml-2 inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        navSolid
          ? "border-b border-primary-border/40 bg-white/85 shadow-sm backdrop-blur-xl"
          : "bg-gradient-to-b from-black/50 to-transparent backdrop-blur-[2px]"
      }`}
    >
      <div className="mx-auto flex max-w-8xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-12">
        <div
          className={`inline-flex shrink-0 items-center transition ${darkNav ? "drop-shadow-md brightness-0 invert" : ""}`}
        >
          <EventtzLogo
            href="/"
            className="inline-flex shrink-0 items-center"
            variant="header"
            imageClassName="h-9 w-auto sm:h-10 md:h-11"
            width={200}
            height={72}
            priority
          />
        </div>

        <nav className="hidden items-center gap-0.5 lg:flex lg:justify-end lg:overflow-visible">
          <NavDropdown darkNav={darkNav} label="Explore" align="left" items={exploreLinks} />

          <NavLinkItem
            href={SIGN_IN_LINK.href}
            className={
              darkNav
                ? "rounded-lg px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
                : "rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-primary"
            }
          >
            {SIGN_IN_LINK.label}
          </NavLinkItem>

          <NavLinkItem href={REGISTER_LINK.href} className={outlineCtaClass}>
            {REGISTER_LINK.label}
          </NavLinkItem>

          <NavLinkItem href={BROWSE_LINK.href} className={primaryCtaClass}>
            {BROWSE_LINK.label}
          </NavLinkItem>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <NavLinkItem
            href={BROWSE_LINK.href}
            className={
              darkNav
                ? "inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-neutral-900"
                : "inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-white"
            }
          >
            Browse
          </NavLinkItem>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className={
              darkNav
                ? "flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white backdrop-blur-sm"
                : "flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800"
            }
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className={`border-t px-4 py-4 lg:hidden ${
            darkNav ? "border-white/10 bg-neutral-950/90 backdrop-blur-md" : "border-neutral-200/80 bg-white"
          }`}
        >
          <div className="flex flex-col gap-1">
            {mobileLinks.map((item) => (
              <NavLinkItem
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  item.primary
                    ? darkNav
                      ? "text-white"
                      : "text-primary"
                    : darkNav
                      ? "text-white/90"
                      : "text-neutral-800"
                }`}
                onClick={closeMobile}
              >
                {item.label}
              </NavLinkItem>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
