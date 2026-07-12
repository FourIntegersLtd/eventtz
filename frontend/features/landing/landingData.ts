import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Banknote,
  Calendar,
  Camera,
  Cake,
  CreditCard,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Tag,
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
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";

export const WAITLIST_URL = "https://forms.gle/6c4Ezw5MNuQaYr238";

/** Matches checkout UI and backend `BOOKING_SERVICE_FEE_PERCENT` (default 5). */
const SERVICE_FEE_PERCENT_LABEL = `${getBookingServiceFeePercent()}%`;

export type LandingStep = {
  step: number;
  title: string;
  description: string;
};

export const VENDOR_STEPS: LandingStep[] = [
  {
    step: 1,
    title: "Build your profile",
    description: "Show your work, set prices, and open your calendar.",
  },
  {
    step: 2,
    title: "Show up in search",
    description: "Clients find you when they're ready to book.",
  },
  {
    step: 3,
    title: "Get paid on completion",
    description: "Stripe pays out after the job is done.",
  },
];

export const CLIENT_STEPS: LandingStep[] = [
  {
    step: 1,
    title: "Find your vendor",
    description: "Filter by service, city, and date.",
  },
  {
    step: 2,
    title: "Agree the details",
    description: "Message, confirm the quote, and check availability.",
  },
  {
    step: 3,
    title: "Lock in your date",
    description: "Pay securely once they accept.",
  },
  {
    step: 4,
    title: "Complete & review",
    description: "Confirm the event went well and leave a review.",
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
    description: "Cakes and sweet tables worth showing off.",
    iconBg: "bg-orange-500",
    iconColor: "text-white",
  },
  {
    name: "Catering",
    value: "catering",
    Icon: UtensilsCrossed,
    description: "Food your guests will remember.",
    iconBg: "bg-rose-500",
    iconColor: "text-white",
  },
  {
    name: "Photography",
    value: "photography",
    Icon: Camera,
    description: "Portfolios, packages, and prices in one place.",
    iconBg: "bg-amber-500",
    iconColor: "text-white",
  },
  {
    name: "Makeup",
    value: "makeup",
    Icon: Sparkles,
    description: "Bridal, party, and on-the-day looks.",
    iconBg: "bg-fuchsia-500",
    iconColor: "text-white",
  },
  {
    name: "Rentals",
    value: "rentals",
    Icon: Package,
    description: "Décor, marquees, furniture, and hire.",
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

export type GalleryVideo = {
  src: string;
  alt: string;
  eventName: string;
};

export const INSPIRATION_SECTION = {
  eyebrow: "Celebrations",
  title: "The kind of events people book here",
} as const;

/**
 * Celebrations carousel — one entry per clip in `public/videos/`.
 * Hero background uses `HERO_VIDEO_SRC` (hero.mp4 is shared with Weddings below).
 * After adding a new file here, run: npm run optimize-videos
 */
export const GALLERY_VIDEOS: GalleryVideo[] = [
  {
    src: "/videos/hero1.mp4",
    alt: "Wedding celebration",
    eventName: "Weddings",
  },
  {
    src: "/videos/hero2.mp4",
    alt: "Birthday party",
    eventName: "Birthdays",
  },
  {
    src: "/videos/hero6.mp4",
    alt: "Gender reveal celebration",
    eventName: "Gender reveals",
  },
  {
    src: "/videos/hero3.mp4",
    alt: "Office party",
    eventName: "Office parties",
  },
  {
    src: "/videos/hero7.mp4",
    alt: "Catering and food at an event",
    eventName: "Catering",
  },
  {
    src: "/videos/hero5.mp4",
    alt: "Celebration with guests",
    eventName: "Celebrations",
  },
];

export type FaqItem = { q: string; a: string };

export type FaqSection = {
  id: "client" | "vendor";
  heading: string;
  items: FaqItem[];
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "client",
    heading: "For clients",
    items: [
      {
        q: "How does booking work?",
        a: "Pick services on a profile. Send your date and venue. Chat to confirm. Pay when they accept.",
      },
      {
        q: "When do I pay?",
        a: "After the vendor accepts. You see the full total before you confirm.",
      },
      {
        q: "Is there a service fee?",
        a: `Yes. ${SERVICE_FEE_PERCENT_LABEL} at checkout. No hidden extras.`,
      },
      {
        q: "Are vendors vetted?",
        a: "Every vendor completes onboarding. We review profiles before they appear in search.",
      },
      {
        q: "What if something goes wrong?",
        a: "Open a dispute from your booking. We review the thread and help resolve it.",
      },
    ],
  },
  {
    id: "vendor",
    heading: "For vendors",
    items: [
      {
        q: "How do I join Eventtz?",
        a: "Create a vendor account. Add your business, services, and photos. Connect Stripe to get paid.",
      },
      {
        q: "When will my profile go live?",
        a: "After onboarding, Stripe verification, and our team approves your listing.",
      },
      {
        q: "How do I get paid?",
        a: "Through Stripe Connect. Client pays. You complete the job. Money hits your account.",
      },
      {
        q: "Does Eventtz take a cut from my earnings?",
        a: `No. Clients pay a ${SERVICE_FEE_PERCENT_LABEL} service fee on top of your quote. You keep what you agreed.`,
      },
      {
        q: "What happens if there is a dispute?",
        a: "Either side can open one. We review it and may hold payout until it's sorted.",
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

/**
 * Hero background — Pexels #3045163 (food/catering prep, free licence).
 * https://www.pexels.com/video/a-person-preparing-food-3045163/
 * Hosted locally because direct hotlinks intermittently return 403.
 */
export const HERO_VIDEO_SRC = "/videos/hero.mp4";

/** Outcome-first hero line (below H1). `accent` is highlighted in the hero. */
export const HERO_SUBHEADLINE = {
  lead: "Eventtz helps you plan your celebrations with",
  accent: "confidence",
  tail: "so you can find trusted vendors and book securely on one platform.",
} as const;

export type LandingValuePillar = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const WHY_EVENTTZ_SECTION = {
  eyebrow: "Why Eventtz",
  title: "Great vendors exist. Finding the right one shouldn't take weeks.",
  description:
    "Right now planning your celebration lives across Instagram, WhatsApp, and word of mouth. Eventtz helps you find, book, and secure vendors for your big day.",
  pains: [
    "I've been chasing the caterer on WhatsApp for weeks.",
    "I keep having to send a DM just to get prices.",
    "They want a deposit. I've never worked with them before.",
  ],
} as const;

export const WHY_EVENTTZ_PILLARS: LandingValuePillar[] = [
  {
    title: "Vetted before they go live",
    description: "Browse vendors we've checked. Every listing is approved.",
    Icon: BadgeCheck,
  },
  {
    title: "One thread, one booking",
    description: "Stop chasing quotes in DMs. Message, agree a price, and book in the same place.",
    Icon: MessageCircle,
  },
  {
    title: "Pay when it's confirmed",
    description: "You pay after the vendor accepts. Full price upfront. No surprises.",
    Icon: CreditCard,
  },
];

export type LandingVendorBenefit = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const VENDOR_SPOTLIGHT_SECTION = {
  eyebrow: "For vendors",
  title: "Your next booking shouldn't come from a DM",
  description:
    "List once. Get found by clients planning events across the UK. Run requests, quotes, and payouts without jumping between apps.",
} as const;

export const VENDOR_SPOTLIGHT_BENEFITS: LandingVendorBenefit[] = [
  {
    title: "Show up when it matters",
    description: "Appear in search by category, city, and date.",
    Icon: MapPin,
  },
  {
    title: "You set the price",
    description: "Packages, hourly rates, or custom quotes. Your call.",
    Icon: Banknote,
  },
  {
    title: "Run bookings in one app",
    description: "Requests, chat, and calendar in the same place.",
    Icon: Calendar,
  },
  {
    title: "Paid through Stripe",
    description: "Connect once. Get paid when the job is complete.",
    Icon: ShieldCheck,
  },
];

export const TRUST_SAFETY_SECTION = {
  eyebrow: "Trust & safety",
  title: "Built for real bookings, not just browsing",
  description: "Clear prices. Secure checkout. A record of every message and payment.",
} as const;

export const TRUST_SAFETY_ITEMS: LandingValuePillar[] = [
  {
    title: "Checked before they go live",
    description: "Vendors don't show up in search until we've checked them.",
    Icon: BadgeCheck,
  },
  {
    title: "Full price before you pay",
    description: `Vendor quote plus ${SERVICE_FEE_PERCENT_LABEL} service fee. Shown in full at checkout.`,
    Icon: CreditCard,
  },
  {
    title: "Everything on the booking",
    description: "Messages, quotes, and payment status tied to one record.",
    Icon: MessageCircle,
  },
  {
    title: "Disputes when things go wrong",
    description: "Either side can flag an issue. Our team reviews and helps resolve it.",
    Icon: ShieldCheck,
  },
];

export type LandingScreenshotSection = {
  title: string;
  description: string;
  /** Optional path under public/, e.g. /images/landing-images/pricing.png */
  screenshotSrc?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export const PRICING_TRUST_SECTION: LandingScreenshotSection = {
  title: "See the price before the DM",
  description:
    "Full packages and sale prices on every listing. Compare before you message.",
  screenshotSrc: "/images/landing-images/pricing.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const BOOK_SECTION: LandingScreenshotSection = {
  title: "Send a booking request",
  description: "Pick a package, add your date and venue, and send the vendor a request.",
  screenshotSrc: "/images/landing-images/book.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const QUOTE_SECTION: LandingScreenshotSection = {
  title: "The vendor confirms your booking",
  description:
    "They review your date, venue, and package. If anything needs adjusting, they update the quote before you pay.",
  screenshotSrc: "/images/landing-images/quote.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const VENDOR_TOOLS_SECTION: LandingScreenshotSection = {
  title: "Your prices, your calendar, one profile",
  description:
    "Set packages, discounts, and availability in onboarding. Take requests, send quotes from chat, and get paid through Stripe when the job is done.",
  screenshotSrc: undefined,
  ctaHref: "/register?type=vendor",
  ctaLabel: "Join as a vendor",
};

export const VENDOR_TOOLS_PILLARS: LandingValuePillar[] = [
  {
    title: "Packages or quotes",
    description: "Fixed packages, rates, or custom quotes from chat.",
    Icon: Package,
  },
  {
    title: "Any discounts?",
    description: "List, bulk, and off-peak rules on your profile.",
    Icon: Tag,
  },
  {
    title: "Your calendar",
    description: "Weekdays, blocked dates, and a daily booking cap.",
    Icon: Calendar,
  },
  {
    title: "Paid through Stripe",
    description: "Connect once. Payout after the job is complete.",
    Icon: ShieldCheck,
  },
];

export type LandingJourneyStage = "browse" | "chat" | "pay";

export type LandingJourneyStep = {
  title: string;
  description: string;
  mockStage: LandingJourneyStage;
  screenshotAlt: string;
  screenshotSrc?: string;
};

export const BOOKING_RECORD_SECTION = {
  eyebrow: "One booking",
  title: "One booking, one record",
  description: "Browse, message, pay, and complete without losing the thread.",
} as const;

export const BOOKING_RECORD_JOURNEY: LandingJourneyStep[] = [
  {
    title: "Browse with clear prices",
    description: "Compare packages before you message.",
    mockStage: "browse",
    screenshotAlt: "Vendor profile with package pricing on Eventtz",
  },
  {
    title: "Agree in chat",
    description: "Message the vendor and accept the quote.",
    mockStage: "chat",
    screenshotAlt: "Chat conversation with a vendor quote on Eventtz",
  },
  {
    title: "Pay and complete",
    description: "Pay after they accept. Leave a review when it's done.",
    mockStage: "pay",
    screenshotAlt: "Secure checkout for an accepted booking on Eventtz",
  },
];

export const HOW_IT_WORKS_SECTION = {
  eyebrow: "How it works",
  title: "From search to booked in four steps",
} as const;

export const FAQ_SECTION = {
  eyebrow: "FAQ",
  title: "Planning in the group chat? That's where things get lost.",
  footnote: "More categories coming. ",
} as const;

export const FEATURED_VENDORS_SECTION = {
  eyebrow: "Marketplace",
  title: "Vendors clients book first",
} as const;

export const REVIEWS_SECTION = {
  eyebrow: "Reviews",
  title: "Real events. Real reviews.",
} as const;

export const BROWSE_SECTION = {
  eyebrow: "Discover",
  title: "Start with the service you need",
} as const;

export const EXPLORE_NAV_LINKS = [
  { href: "#browse", label: "Categories" },
  { href: "#featured", label: "Featured vendors" },
  { href: "#reviews", label: "Reviews" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing-trust", label: "Pricing" },
  { href: "#book-request", label: "Book" },
  { href: "#quote-accept", label: "Confirm" },
  { href: "#why-eventtz", label: "Why Eventtz" },
  { href: "#inspiration", label: "Celebrations" },
  { href: "#for-vendors", label: "For vendors" },
  { href: "#faq", label: "FAQ" },
] as const;

/** One login, one register — the account-type dropdown on `/register` replaces separate client/vendor forms. */
export const SIGN_IN_LINK = { href: "/login", label: "Sign in" } as const;
export const BROWSE_LINK = { href: "/client/browse", label: "Browse" } as const;
export const REGISTER_LINK = { href: "/register", label: "Register" } as const;
export const CREATE_ACCOUNT_LINK = { href: "/register", label: "Create account" } as const;
export const FAQ_LINK = { href: "#faq", label: "FAQ" } as const;
export const WAITLIST_LINK_LABEL = "Join the waitlist" as const;

export type MobileNavLink = {
  href: string;
  label: string;
  primary?: boolean;
};

export const MOBILE_NAV_LINKS: MobileNavLink[] = [
  ...EXPLORE_NAV_LINKS,
  SIGN_IN_LINK,
  BROWSE_LINK,
  { ...REGISTER_LINK, primary: true },
];
