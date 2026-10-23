/**
 * Link and class data for the public-site chrome (LandingNav, LandingFooter): shared by the landing
 * page, blog, marketplace shell, error pages and legal pages, so it lives in components/.
 */
import type { IconType } from "react-icons";
// Simple Icons dropped LinkedIn (react-icons 5.7), so it comes from Font Awesome.
import { FaLinkedin } from "react-icons/fa";
import { SiFacebook, SiInstagram, SiTiktok, SiX } from "react-icons/si";
import { FOOTER_CONTACT_EMAIL } from "@/lib/footerLinks";

export const WAITLIST_URL = "https://forms.gle/6c4Ezw5MNuQaYr238";

export type SocialLink = {
  name: string;
  href: string;
  aria: string;
  Icon: IconType;
  color: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/eventtz_/",
    aria: "Eventtz on Instagram",
    Icon: SiInstagram,
    color: "text-primary",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@eventtz?is_from_webapp=1&sender_device=pc",
    aria: "Eventtz on TikTok",
    Icon: SiTiktok,
    color: "text-primary",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61588127226543",
    aria: "Eventtz on Facebook",
    Icon: SiFacebook,
    color: "text-primary",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/eventtz/?lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3BKW%2FYdf5RREu1tgdsOnlkQg%3D%3D",
    aria: "Eventtz on LinkedIn",
    Icon: FaLinkedin,
    color: "text-primary",
  },
  {
    name: "Twitter",
    href: "https://x.com/eventtz",
    aria: "Eventtz on Twitter",
    Icon: SiX,
    color: "text-primary",
  },
];

/** Top-level nav link classes; light-on-dark when the nav sits over the hero. */
export function navLinkClass(darkNav: boolean): string {
  return darkNav
    ? "rounded-control px-3 py-2 text-sm font-medium text-white/95 transition hover:bg-white/10"
    : "rounded-control px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-3 hover:text-ink";
}

export const NAV_DROPDOWN_LINK_CLASS =
  "block rounded-control px-3 py-2.5 text-sm text-ink-2 transition hover:bg-surface-3 hover:text-ink";

export const EXPLORE_NAV_LINKS = [
  { href: "/client/browse", label: "Browse vendors" },
  { href: "#booking-journey", label: "How booking works" },
  { href: "#for-vendors", label: "For vendors" },
  { href: "#faq", label: "FAQ" },
] as const;

/** One login, one register - the account-type dropdown on `/register` replaces separate client/vendor forms. */
export const SIGN_IN_LINK = { href: "/login", label: "Sign in" } as const;
export const BROWSE_LINK = { href: "/client/browse", label: "Browse" } as const;
export const BLOG_LINK = { href: "/blog", label: "Blog" } as const;
export const REGISTER_LINK = { href: "/register", label: "Register" } as const;
export const CREATE_ACCOUNT_LINK = { href: "/register", label: "Create account" } as const;
export const WAITLIST_LINK_LABEL = "Join the waitlist" as const;
export const CONTACT_US_LINK = {
  href: `mailto:${FOOTER_CONTACT_EMAIL}`,
  label: "Contact us",
} as const;

/** Section-link prefix: `/` off the home page (so `#faq` becomes `/#faq`), else the explicit one. */
export function resolveLandingSectionPrefix(
  pathname: string,
  explicit: "" | "/" = "",
): "" | "/" {
  if (pathname !== "/") return "/";
  return explicit;
}

export type MobileNavLink = {
  href: string;
  label: string;
};

/** Short list for the mobile drawer - desktop keeps the full Explore dropdown. */
export const MOBILE_NAV_SECTION_LINKS: MobileNavLink[] = [
  { href: "/client/browse", label: "Browse vendors" },
  { href: "/blog", label: "Blog" },
  { href: "#booking-journey", label: "How booking works" },
  { href: "#for-vendors", label: "For vendors" },
  { href: "#faq", label: "FAQ" },
  { href: CONTACT_US_LINK.href, label: CONTACT_US_LINK.label },
];
