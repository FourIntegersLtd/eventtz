import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Cake,
  Package,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiFacebook,
  SiInstagram,
  SiLinkedin,
  SiTiktok,
  SiX,
} from "react-icons/si";

export const WAITLIST_URL = "https://forms.gle/6c4Ezw5MNuQaYr238";

export type LandingStep = {
  step: number;
  title: string;
  description: string;
};

export const VENDOR_STEPS: LandingStep[] = [
  {
    step: 1,
    title: "Create your profile",
    description: "Add services, portfolio, and availability.",
  },
  {
    step: 2,
    title: "Get discovered",
    description: "Clients find you by category and city across the UK.",
  },
  {
    step: 3,
    title: "Confirm & get paid",
    description: "Manage bookings and receive payouts via Stripe.",
  },
];

export const CLIENT_STEPS: LandingStep[] = [
  {
    step: 1,
    title: "Browse vendors",
    description: "Search by service, city, and event date.",
  },
  {
    step: 2,
    title: "Send a request",
    description: "Message vendors and request a booking.",
  },
  {
    step: 3,
    title: "Book & pay",
    description: "Accept quotes and pay securely in-app.",
  },
];

export type LandingCategory = {
  name: string;
  /** Matches SERVICE_OPTIONS values in vendor-onboarding/constants.ts — used for `?types=` filtering and count lookups. */
  value: string;
  Icon: LucideIcon;
  description: string;
  iconBg: string;
  iconColor: string;
};

export const CATEGORIES: LandingCategory[] = [
  {
    name: "Baking",
    value: "baking",
    Icon: Cake,
    description:
      "Custom cakes, dessert tables, and sweet spreads for weddings, parties, and corporate events.",
    iconBg: "bg-orange-500",
    iconColor: "text-white",
  },
  {
    name: "Catering",
    value: "catering",
    Icon: UtensilsCrossed,
    description:
      "Food and drink for your event: small chops, buffets, swallow & soup, and full menus for any size of crowd.",
    iconBg: "bg-rose-500",
    iconColor: "text-white",
  },
  {
    name: "Photography",
    value: "photography",
    Icon: Camera,
    description:
      "Professional photographers for weddings, parties and events. Compare portfolios and packages.",
    iconBg: "bg-amber-500",
    iconColor: "text-white",
  },
  {
    name: "Makeup",
    value: "makeup",
    Icon: Sparkles,
    description:
      "Makeup artists for bridal, party, and special-occasion looks, including trials and on-the-day.",
    iconBg: "bg-fuchsia-500",
    iconColor: "text-white",
  },
  {
    name: "Rentals",
    value: "rentals",
    Icon: Package,
    description:
      "Furniture, décor, marquees, and equipment hire, matched to your venue and style.",
    iconBg: "bg-violet-600",
    iconColor: "text-white",
  },
];

/** Strip above the fold uses the same categories as the detailed grid. */
export const BROWSE_CATEGORIES = CATEGORIES;

const HERO_QUICK_LINK_LABELS: Record<string, string> = {
  baking: "Custom cakes & baking",
  catering: "Catering & drinks",
};

/** Derived from CATEGORIES so the hero quick links can't drift out of sync with the category list. */
export const HERO_QUICK_LINKS = CATEGORIES.map(({ name, value }) => ({
  label: HERO_QUICK_LINK_LABELS[value] ?? name,
  href: `/client/browse?types=${value}`,
}));

export type GalleryImage = {
  src: string;
  alt: string;
  eventName: string;
};

export const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: "/images/birthday1.jpg",
    alt: "Birthday celebration",
    eventName: "Birthdays",
  },
  {
    src: "/images/naming.jpg",
    alt: "Event moment",
    eventName: "Gender Reveals",
  },
  {
    src: "/images/office.jpg",
    alt: "Celebration",
    eventName: "Office Parties",
  },
  { src: "/images/wedding.jpg", alt: "Party", eventName: "Weddings" },
];

export type FaqItem = { q: string; a: string };

export type FaqSection = {
  heading: string;
  items: FaqItem[];
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    heading: "For clients",
    items: [
      {
        q: "What is Eventtz?",
        a: "Eventtz is a UK marketplace focused on African vendors, for anyone planning weddings, parties, and corporate events in Britain. We help you discover and compare trusted vendors across baking, catering, photography, makeup, and rentals, with more tools for search, messaging, and secure booking as we roll out.",
      },
      {
        q: "What types of vendors can I find?",
        a: "We focus on five core categories: baking, catering, photography, makeup, and rentals (for example furniture, décor, or equipment hire). You can browse by category to shortlist vendors that fit your event.",
      },
      {
        q: "Do I need an account to browse?",
        a: "Create a free client account to search vendors, save favourites, message, and request bookings.",
      },
      {
        q: "How will booking and payment work?",
        a: "Request a booking from a vendor profile, agree on a quote in chat, then pay securely in-app via Stripe.",
      },
      {
        q: "Is Eventtz only for weddings?",
        a: "No. Weddings are huge for us, but Eventtz is for birthdays, traditional and religious celebrations, naming ceremonies, corporate events, and every kind of party, anywhere in the UK.",
      },
      {
        q: "What if I need a vendor type you don’t list yet?",
        a: "We’re starting with our core categories so quality stays high. For anything outside that scope, we may expand over time. Join the waitlist and tell us what you’re looking for.",
      },
    ],
  },
  {
    heading: "For vendors",
    items: [
      {
        q: "How do I join Eventtz as a vendor?",
        a: "Create a vendor account, then complete onboarding: business details and services, your UK base and how you travel or deliver, availability, portfolio and links, and Stripe Connect for verification and payouts. You’ll review everything before submission.",
      },
      {
        q: "Which services can I offer?",
        a: "You can list baking, catering, photography, makeup, or rentals. If your business doesn’t fit those categories, choose Other during onboarding. We’ll open a short waitlist form so we can follow up when we’re ready to support more vendor types.",
      },
      {
        q: "Can I set hourly rates and fixed packages?",
        a: "Yes. You can add hourly and daily rates, and create multiple named packages with price, duration, and details. You can also indicate whether each package follows your default travel and delivery rules from your location settings.",
      },
      {
        q: "How do I handle travel and delivery fees?",
        a: "You set your base city, how far you travel, and a default policy (for example fee included, free within your base city, or fees confirmed after a booking request). You can align each package with that default or treat it differently.",
      },
      {
        q: "How do I get paid?",
        a: "Onboarding includes Stripe Connect so identity checks and payouts can run securely. You’ll complete Connect as part of the flow before your profile is fully live for bookings.",
      },
      {
        q: "When will Eventtz launch?",
        a: "We’re in the final stages of building. Join the waitlist to get updates and early access when we open more widely to clients and vendors.",
      },
    ],
  },
];

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
    Icon: SiLinkedin,
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

export const NAV_DROPDOWN_LINK_CLASS =
  "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-primary";

/** Moody catering / event prep — free stock (Pexels). Replace with your own `public/videos/hero.mp4` if desired. */
export const HERO_VIDEO_SRC =
  "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_30fps.mp4";
export const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1920&q=80";

export const EXPLORE_NAV_LINKS = [
  { href: "#browse", label: "Categories" },
  { href: "#featured", label: "Featured vendors" },
  { href: "#inspiration", label: "Event inspiration" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

/** One login, one register — the account-type dropdown on `/register` replaces separate client/vendor forms. */
export const SIGN_IN_LINK = { href: "/login", label: "Sign in" } as const;
export const BROWSE_LINK = { href: "/client/browse", label: "Browse" } as const;
export const LIST_BUSINESS_LINK = { href: "/vendor/register", label: "List your business" } as const;
export const CREATE_ACCOUNT_LINK = { href: "/register", label: "Create account" } as const;

export type MobileNavLink = {
  href: string;
  label: string;
  primary?: boolean;
};

export const MOBILE_NAV_LINKS: MobileNavLink[] = [
  ...EXPLORE_NAV_LINKS,
  SIGN_IN_LINK,
  BROWSE_LINK,
  { ...LIST_BUSINESS_LINK, primary: true },
];
