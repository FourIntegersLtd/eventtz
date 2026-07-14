"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { getButtonClassName } from "@/components/ui/buttonStyles";
import {
  BLOG_LINK,
  BROWSE_LINK,
  EXPLORE_NAV_LINKS,
  REGISTER_LINK,
  MOBILE_NAV_SECTION_LINKS,
  NAV_DROPDOWN_LINK_CLASS,
  SIGN_IN_LINK,
} from "@/features/landing/landingData";
import { useLandingNavScroll } from "@/features/landing/useLandingNavScroll";
import { LANDING_PAGE_CONTAINER_CLASS } from "@/features/landing/landingSectionStyles";

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

  const mobileSectionLinks = MOBILE_NAV_SECTION_LINKS.map((item) => ({
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

  const outlineCtaClass = getButtonClassName({
    variant: darkNav ? "invertedOutline" : "outline",
    shape: "pill",
    className: "ml-1 px-4 py-2",
  });

  const primaryCtaClass = getButtonClassName({
    variant: darkNav ? "inverted" : "primary",
    shape: "pill",
    className: "ml-2 px-5 py-2",
  });

  const mobileHeaderBrowseClass = getButtonClassName({
    variant: darkNav ? "inverted" : "primary",
    shape: "pill",
    className: "inline-flex shrink-0 items-center px-4 py-2.5 text-xs font-semibold sm:text-sm",
  });

  const mobileMenuPrimaryClass = getButtonClassName({
    variant: darkNav ? "inverted" : "primary",
    shape: "pill",
    className: "inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold",
  });

  const mobileMenuSecondaryClass = getButtonClassName({
    variant: darkNav ? "invertedOutline" : "outline",
    shape: "pill",
    className: "inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold",
  });

  return (
    <>
      {mobileOpen ? (
        <div
          className={`fixed inset-0 z-[90] lg:hidden ${darkNav ? "bg-neutral-950" : "bg-white"}`}
          aria-hidden
        />
      ) : null}

      <header
        className={`fixed top-0 left-0 right-0 z-[100] pt-[env(safe-area-inset-top)] transition-all duration-300 ${
          mobileOpen
            ? darkNav
              ? "bg-neutral-950"
              : "bg-white shadow-sm"
            : navSolid
              ? "border-b border-primary-border/40 bg-white/85 shadow-sm backdrop-blur-xl"
              : "bg-gradient-to-b from-black/50 to-transparent backdrop-blur-[2px]"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 py-3 sm:py-2.5 ${LANDING_PAGE_CONTAINER_CLASS}`}
        >
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

          <nav className="hidden items-center gap-0.5 lg:ml-auto lg:flex lg:justify-end lg:overflow-visible">
            <NavDropdown darkNav={darkNav} label="Explore" align="left" items={exploreLinks} />

            <NavLinkItem
              href={BLOG_LINK.href}
              className={
                darkNav
                  ? "rounded-lg px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
                  : "rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-primary"
              }
            >
              {BLOG_LINK.label}
            </NavLinkItem>

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

            <NavLinkItem href={REGISTER_LINK.href} className={primaryCtaClass}>
              {REGISTER_LINK.label}
            </NavLinkItem>

            {/* <NavLinkItem href={BROWSE_LINK.href} className={primaryCtaClass}>
              {BROWSE_LINK.label}
            </NavLinkItem> */}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2.5 lg:hidden">
            <NavLinkItem href={BROWSE_LINK.href} className={mobileHeaderBrowseClass}>
              {BROWSE_LINK.label}
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
      </header>

      {mobileOpen ? (
        <div
          className={`fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[95] overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))] lg:hidden ${
            darkNav ? "text-white" : "text-neutral-900"
          }`}
        >
          <div className={`flex flex-col ${LANDING_PAGE_CONTAINER_CLASS}`}>
            <nav className="flex flex-col gap-1 pt-2">
              {mobileSectionLinks.map((item) => (
                <NavLinkItem
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`rounded-lg py-3.5 text-[15px] font-medium leading-none ${
                    darkNav ? "text-white/90 hover:bg-white/10" : "text-neutral-800 hover:bg-neutral-50"
                  }`}
                  onClick={closeMobile}
                >
                  {item.label}
                </NavLinkItem>
              ))}
            </nav>

            <div
              className={`mt-10 flex flex-col gap-3 border-t pt-6 ${
                darkNav ? "border-white/10" : "border-neutral-200/80"
              }`}
            >
              <NavLinkItem
                href={BROWSE_LINK.href}
                className={mobileMenuPrimaryClass}
                onClick={closeMobile}
              >
                {BROWSE_LINK.label} vendors
              </NavLinkItem>
              <NavLinkItem
                href={REGISTER_LINK.href}
                className={mobileMenuSecondaryClass}
                onClick={closeMobile}
              >
                {REGISTER_LINK.label}
              </NavLinkItem>
              <NavLinkItem
                href={SIGN_IN_LINK.href}
                className={`rounded-lg py-3.5 text-center text-[15px] font-medium ${
                  darkNav ? "text-white/80 hover:text-white" : "text-neutral-600 hover:text-primary"
                }`}
                onClick={closeMobile}
              >
                {SIGN_IN_LINK.label}
              </NavLinkItem>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
