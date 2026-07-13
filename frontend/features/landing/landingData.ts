import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Camera,
  Cake,
  CircleCheck,
  CreditCard,
  MessageCircle,
  Package,
  Search,
  Send,
  ShieldCheck,
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
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";

export const WAITLIST_URL = "https://forms.gle/6c4Ezw5MNuQaYr238";

/** Matches checkout UI and backend `BOOKING_SERVICE_FEE_PERCENT` (default 5). */
const SERVICE_FEE_PERCENT_LABEL = `${getBookingServiceFeePercent()}%`;

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
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  {
    name: "Catering",
    value: "catering",
    Icon: UtensilsCrossed,
    description: "Food your guests will remember.",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-500",
  },
  {
    name: "Photography",
    value: "photography",
    Icon: Camera,
    description: "See services and prices on every profile before you send a message.",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    name: "Makeup",
    value: "makeup",
    Icon: Sparkles,
    description: "Bridal, party, and on-the-day looks.",
    iconBg: "bg-fuchsia-100",
    iconColor: "text-fuchsia-500",
  },
  {
    name: "Rentals",
    value: "rentals",
    Icon: Package,
    description: "Décor, marquees, furniture, and hire.",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
];

/** Strip above the fold uses the same categories as the detailed grid. */
export const BROWSE_CATEGORIES = CATEGORIES;

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
        a: "Choose a vendor, add your date and venue, chat to agree the price, then pay once the vendor accepts. Everything stays in one place.",
      },
      {
        q: "When do I pay?",
        a: "After the vendor accepts. You see the full total, including our service fee, before you pay.",
      },
      {
        q: "Is there a service fee?",
        a: `Yes. ${SERVICE_FEE_PERCENT_LABEL}, shown before you pay. No hidden extras.`,
      },
      {
        q: "Is my payment safe?",
        a: "Yes. We hold your payment until the event is done. The vendor is paid once you and the vendor confirm it went well, or automatically 48 hours after the event if there is no problem.",
      },
      {
        q: "What if I need to cancel?",
        a: "You can cancel from your booking before the vendor is paid. If you have already paid, you get a full refund back to your card, usually within 5-10 working days.",
      },
      {
        q: "Are vendors vetted?",
        a: "Every vendor completes onboarding. Each profile is reviewed before going live on Eventtz.",
      },
      {
        q: "What if something goes wrong?",
        a: "Report a problem from your booking. We pause payment to the vendor and help sort it out.",
      },
    ],
  },
  {
    id: "vendor",
    heading: "For vendors",
    items: [
      {
        q: "How do I join Eventtz?",
        a: "Create your profile, add your services, and connect payments.",
      },
      {
        q: "When will my profile go live?",
        a: "After you finish setup, verify with Stripe, and our team approves your profile.",
      },
      {
        q: "How do I get paid?",
        a: "When a client books you, payment comes through Eventtz. After the event, mark it complete to get paid, or automatically 48 hours after the event if there is no problem.",
      },
      {
        q: "Does Eventtz take a cut from my earnings?",
        a: `No. Clients pay a ${SERVICE_FEE_PERCENT_LABEL} service fee on top of your quote. You keep what you agreed.`,
      },
      {
        q: "What happens if there is a dispute?",
        a: "You or the client can report a problem. We review it and may hold payment until it is sorted.",
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

/** Light marketing hero — left copy column. Right column reserved for hero image. */
export const HERO_EYEBROW = "Trusted African event vendors";

export const HERO_HEADLINE = {
  lead: "Best place to hire top",
  sticky: "African",
} as const;

/** Rotates inside the purple highlight on the hero H1. */
export const HERO_ROTATING_WORDS = [
  "vendors",
  "photographers",
  "caterers",
  "bakers",
  "makeup artists",
] as const;

/** Outcome-first hero line (below H1). */
export const HERO_SUBHEADLINE = {
  lead: "Eventtz helps you find and book trusted vendors securely, so you can plan your celebrations with ",
  accent: "confidence",
  tail: ".",
} as const;

export const HERO_CTA = {
  label: "Hire top African vendors",
  href: "/client/browse",
} as const;

export type LandingValuePillar = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const WHY_EVENTTZ_SECTION = {
  eyebrow: "Why Eventtz",
  title: "The vendors exist. The booking lives in the group chat.",
  description:
    "You can find great vendors, but dates, prices, and payment still get lost in DMs and screenshots. Eventtz helps you find trusted vendors and handle payments safely, all in one place.",
} as const;

export const WHY_EVENTTZ_PILLARS: LandingValuePillar[] = [
  {
    title: "Checked before you book",
    description: "Every vendor is reviewed before going live on Eventtz.",
    Icon: BadgeCheck,
  },
  {
    title: "One thread, one booking",
    description: "Message, agree a price, and book without switching apps.",
    Icon: MessageCircle,
  },
  {
    title: "Pay when it's confirmed",
    description: "See the full price before you pay.",
    Icon: CreditCard,
  },
  {
    title: "Help when things go wrong",
    description: "Tell us what went wrong and we hold payment until it's sorted.",
    Icon: ShieldCheck,
  },
];

export type LandingScreenshotSection = {
  eyebrow?: string;
  title: string;
  description: string;
  /** Optional path under public/, e.g. /images/landing-images/pricing.png */
  screenshotSrc?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export type LandingScrollFeatureStep = {
  id: string;
  stepLabel: string;
  title: string;
  description: string;
  quote?: string;
  imageSrc?: string;
  imageAlt: string;
  /** Screenshot already includes border/chrome; skip the landing frame border. */
  imageFrameless?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  Icon: LucideIcon;
};

export const PRICING_TRUST_SECTION: LandingScreenshotSection = {
  eyebrow: "Browse",
  title: "See the price before the DM",
  description:
    "Every listing shows services and sale prices upfront, so you can compare vendors before you send a message.",
  screenshotSrc: "/images/landing-images/pricing.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const BOOK_SECTION: LandingScreenshotSection = {
  eyebrow: "Request",
  title: "One request stays on the record",
  description:
    "Pick your service, add your date and venue, and send a request that lives on one booking from day one.",
  screenshotSrc: "/images/landing-images/book.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const CHAT_SECTION: LandingScreenshotSection = {
  eyebrow: "Agree",
  title: "Sort the details in one thread",
  description:
    "Message the vendor, tweak the service, and get a clear quote back, all in the same conversation instead of scattered DMs.",
  screenshotSrc: "/images/landing-images/chat.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const QUOTE_SECTION: LandingScreenshotSection = {
  eyebrow: "Confirm",
  title: "They confirm before you pay",
  description:
    "The vendor checks your details and locks in the price before checkout, so you're never paying blind.",
  screenshotSrc: "/images/landing-images/quote.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const CLIENT_JOURNEY_SCROLL_SECTION = {
  eyebrow: "How booking works",
  title: "From browsing to booked, in one place.",
  description:
    "Compare vendors, agree the plan together, and pay when you're ready, without losing track in another group chat.",
  summary:
    "See prices before you message anyone. Pick who you like, chat through the details, and pay when you're both happy.",
} as const;

export const CLIENT_JOURNEY_SCROLL_STEPS: LandingScrollFeatureStep[] = [
  {
    id: "pricing-trust",
    stepLabel: "Browse",
    title: PRICING_TRUST_SECTION.title,
    description: PRICING_TRUST_SECTION.description,
    quote: "I keep having to send a DM just to get prices.",
    imageSrc: PRICING_TRUST_SECTION.screenshotSrc,
    imageAlt: "Vendor profile with service pricing and discounts on Eventtz",
    ctaHref: PRICING_TRUST_SECTION.ctaHref,
    ctaLabel: PRICING_TRUST_SECTION.ctaLabel,
    Icon: Search,
  },
  {
    id: "book-request",
    stepLabel: "Request",
    title: BOOK_SECTION.title,
    description: BOOK_SECTION.description,
    quote: "I've been chasing the caterer on WhatsApp for weeks.",
    imageSrc: BOOK_SECTION.screenshotSrc,
    imageAlt: "Request a booking on Eventtz",
    ctaHref: BOOK_SECTION.ctaHref,
    ctaLabel: BOOK_SECTION.ctaLabel,
    Icon: Send,
  },
  {
    id: "chat-quote",
    stepLabel: "Agree",
    title: CHAT_SECTION.title,
    description: CHAT_SECTION.description,
    quote: "Every question turned into three more messages somewhere else.",
    imageSrc: CHAT_SECTION.screenshotSrc,
    imageAlt: "Chat conversation with a vendor quote on Eventtz",
    ctaHref: CHAT_SECTION.ctaHref,
    ctaLabel: CHAT_SECTION.ctaLabel,
    Icon: MessageCircle,
  },
  {
    id: "quote-accept",
    stepLabel: "Confirm",
    title: QUOTE_SECTION.title,
    description: QUOTE_SECTION.description,
    quote: "They want a deposit. I've never worked with them before.",
    imageSrc: QUOTE_SECTION.screenshotSrc,
    imageAlt: "Vendor booking with accept and reject on Eventtz",
    ctaHref: QUOTE_SECTION.ctaHref,
    ctaLabel: QUOTE_SECTION.ctaLabel,
    Icon: CircleCheck,
  },
];

export const VENDOR_SECTION = {
  eyebrow: "For vendors",
  title: "List your services, take bookings, and get paid when the event is done.",
  ctaHref: "/register?type=vendor",
  ctaLabel: "Join as a vendor",
} as const;

export const CLIENT_AUDIENCE_CTA = {
  eyebrow: "Clients",
  title: "Stop searching in the group chat.",
  description:
    "Find vetted vendors, agree the details in one place, and book without another group chat.",
  href: "/client/browse",
  label: "Browse vendors",
} as const;

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
  description:
    "From the first browse to the final review, every message, quote, and payment stays on the same booking.",
} as const;

export const BOOKING_RECORD_JOURNEY: LandingJourneyStep[] = [
  {
    title: "Browse with clear prices",
    description: "Compare services on each profile before you open a message.",
    mockStage: "browse",
    screenshotAlt: "Vendor profile with service pricing on Eventtz",
  },
  {
    title: "Agree in chat",
    description: "Work through the details in the thread and accept the quote when it's right.",
    mockStage: "chat",
    screenshotAlt: "Chat conversation with a vendor quote on Eventtz",
  },
  {
    title: "Pay and complete",
    description: "Pay after they accept, then confirm the event went well and leave a review.",
    mockStage: "pay",
    screenshotAlt: "Secure checkout for an accepted booking on Eventtz",
  },
];

export const FAQ_SECTION = {
  eyebrow: "FAQ",
  title: "Planning in the group chat? That's where things get lost.",
} as const;

export const FEATURED_VENDORS_SECTION = {
  eyebrow: "Marketplace",
  title: "Vendors people actually book",
} as const;

export const REVIEWS_SECTION = {
  eyebrow: "Reviews",
  title: "Real events. Real reviews.",
} as const;

export const BROWSE_SECTION = {
  eyebrow: "Discover",
  title: "Start with what you need",
  description: "Pick a category and jump straight into trusted vendors.",
} as const;

export const EXPLORE_NAV_LINKS = [
  { href: "#browse", label: "Categories" },
  { href: "#featured", label: "Featured vendors" },
  { href: "#reviews", label: "Reviews" },
  { href: "#booking-journey", label: "How booking works" },
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
};

/** Short list for the mobile drawer — desktop keeps the full Explore dropdown. */
export const MOBILE_NAV_SECTION_LINKS: MobileNavLink[] = [
  { href: "#booking-journey", label: "How booking works" },
  { href: "#for-vendors", label: "For vendors" },
  { href: "#faq", label: "FAQ" },
];
