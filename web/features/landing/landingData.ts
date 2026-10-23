import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CircleCheck,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { VENDOR_SERVICE_CATEGORIES } from "@/lib/vendorServiceCatalog";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";


/** Matches checkout UI and backend `BOOKING_SERVICE_FEE_PERCENT` (constant 5%). */
const SERVICE_FEE_PERCENT_LABEL = `${getBookingServiceFeePercent()}%`;

export type LandingCategory = {
  name: string;
  /** Matches SERVICE_OPTIONS values in vendor-onboarding/constants.ts - used for `?types=` filtering and count lookups. */
  value: string;
  Icon: LucideIcon;
  description: string;
  iconBg: string;
  iconColor: string;
};

export const CATEGORIES: LandingCategory[] = VENDOR_SERVICE_CATEGORIES.map(
  ({ value, label, description, Icon, iconBg, iconColor }) => ({
    name: label,
    value,
    Icon,
    description,
    iconBg,
    iconColor,
  }),
);

/** Hero browse strip — original five categories only; full grid uses `CATEGORIES`. */
export const BROWSE_CATEGORIES = CATEGORIES.slice(0, 5);

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
 * Celebrations carousel - one entry per clip in `public/videos/`.
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
        a: "Choose a vendor, add your date and venue, pick a listed price yourself or chat to agree a custom quote, then pay once the vendor accepts. Everything stays in one place",
      },
      {
        q: "When do I pay?",
        a: "After the vendor accepts. You see the full total, including our service fee, before you pay",
      },
      {
        q: "Is there a service fee?",
        a: `Yes. ${SERVICE_FEE_PERCENT_LABEL} on the vendor total, shown before you pay. With a vendor referral link, clients can save £10–£15 off that fee at higher spend tiers`,
      },
      {
        q: "Is my payment safe?",
        a: "Yes. We hold your payment until the event is done. The vendor is paid once you and the vendor confirm it went well, or automatically 48 hours after the event if there is no problem",
      },
      {
        q: "What if I need to cancel?",
        a: "You can cancel from your booking any time before the vendor is paid. Within 24 hours of paying you get a full refund. After that, your refund follows the vendor's cancellation policy, which you see before you pay, and the Eventtz service fee is always refunded. Refunds usually reach your card within 5-10 working days",
      },
      {
        q: "Are vendors vetted?",
        a: "Every vendor completes onboarding. Each profile is reviewed before going live on Eventtz",
      },
      {
        q: "What if something goes wrong?",
        a: "Report a problem from your booking. We pause payment to the vendor and help sort it out",
      },
    ],
  },
  {
    id: "vendor",
    heading: "For vendors",
    items: [
      {
        q: "How do I join Eventtz?",
        a: "Create your profile, add your services, and connect payments",
      },
      {
        q: "When will my profile go live?",
        a: "After you finish setup, verify with Stripe, and our team approves your profile",
      },
      {
        q: "How do I get paid?",
        a: "When a client books you, payment comes through Eventtz. After the event, mark it complete to get paid, or automatically 48 hours after the event if there is no problem",
      },
      {
        q: "Does Eventtz take a cut from my earnings?",
        a: `No. Clients pay a ${SERVICE_FEE_PERCENT_LABEL} service fee on top of your quote. You keep what you agreed`,
      },
      {
        q: "What happens if there is a dispute?",
        a: "You or the client can report a problem. We review it and may hold payment until it is sorted",
      },
    ],
  },
];

/**
 * Hero background - Pexels #3045163 (food/catering prep, free licence).
 * https://www.pexels.com/video/a-person-preparing-food-3045163/
 * Hosted locally because direct hotlinks intermittently return 403.
 */
export const HERO_VIDEO_SRC = "/videos/hero.mp4";

/** Light marketing hero - left copy column. Right column reserved for hero image. */
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
  tail: "",
} as const;

export const HERO_CTA = {
  label: "Hire top African vendors",
  href: "/client/browse",
} as const;

export type LandingValuePillar = {
  title: string;
  description: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

export const WHY_EVENTTZ_SECTION = {
  eyebrow: "Why Eventtz",
  title: "Eventtz helps you find trusted vendors and book them in one place",
} as const;

export const WHY_EVENTTZ_PILLARS: LandingValuePillar[] = [
  {
    title: "Checked before you book",
    description: "Every vendor is reviewed before going live on Eventtz",
    Icon: BadgeCheck,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  {
    title: "One thread, one booking",
    description: "Message, agree a price, and book without switching apps",
    Icon: MessageCircle,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-500",
  },
  {
    title: "Pay when it's confirmed",
    description:
      "See the full price before you pay. If something goes wrong, we hold payment until it's sorted",
    Icon: ShieldCheck,
    iconBg: "bg-primary-soft",
    iconColor: "text-primary",
  },
];

export type LandingScreenshotSection = {
  eyebrow?: string;
  title: string;
  description: string;
  /** Optional path under public/, e.g. /images/landing-images/browse.png */
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
  title: "See prices before you message",
  description: "Vendors list their services and prices on their profile.",
  screenshotSrc: "/images/landing-images/browse.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const BOOK_SECTION: LandingScreenshotSection = {
  eyebrow: "Request",
  title: "Send a booking request",
  description:
    "Choose a service, add your date and venue, and send the request.",
  screenshotSrc: "/images/landing-images/request.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const CHAT_SECTION: LandingScreenshotSection = {
  eyebrow: "Agree",
  title: "Chat and agree the details",
  description: "Ask questions, adjust the service, and get an updated quote.",
  screenshotSrc: "/images/landing-images/agree.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const QUOTE_SECTION: LandingScreenshotSection = {
  eyebrow: "Confirm",
  title: "Vendor confirms, then you pay",
  description: "The vendor confirms the price; you pay after they accept.",
  screenshotSrc: "/images/landing-images/confirm.png",
  ctaHref: "/client/browse",
  ctaLabel: "Browse vendors",
};

export const CLIENT_JOURNEY_SCROLL_SECTION = {
  eyebrow: "How booking works",
  title: "Browse, request, agree, and pay in one place",
  summary:
    "No chasing prices in DMs. No lost messages. The whole booking stays on Eventtz from start to finish.",
} as const;

export const CLIENT_JOURNEY_SCROLL_STEPS: LandingScrollFeatureStep[] = [
  {
    id: "pricing-trust",
    stepLabel: "Browse",
    title: PRICING_TRUST_SECTION.title,
    description: PRICING_TRUST_SECTION.description,
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
    imageSrc: QUOTE_SECTION.screenshotSrc,
    imageAlt: "Vendor booking with accept and reject on Eventtz",
    ctaHref: QUOTE_SECTION.ctaHref,
    ctaLabel: QUOTE_SECTION.ctaLabel,
    Icon: CircleCheck,
  },
];

export const VENDOR_SECTION = {
  eyebrow: "For vendors",
  title: "List your services, take bookings, and get paid when the event is done",
  ctaHref: "/register?type=vendor",
  ctaLabel: "Join as a vendor",
} as const;

export const CLIENT_AUDIENCE_CTA = {
  eyebrow: "Clients",
  title: "Stop searching in the group chat",
  description:
    "Find vetted vendors, agree the details in one place, and book without another group chat",
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
    "From the first browse to the final review, every message, quote, and payment stays on the same booking",
} as const;

export const BOOKING_RECORD_JOURNEY: LandingJourneyStep[] = [
  {
    title: "Browse with clear prices",
    description: "Compare services on each profile before you open a message",
    mockStage: "browse",
    screenshotAlt: "Vendor profile with service pricing on Eventtz",
  },
  {
    title: "Agree in chat",
    description: "Work through the details in the thread and accept the quote when it's right",
    mockStage: "chat",
    screenshotAlt: "Chat conversation with a vendor quote on Eventtz",
  },
  {
    title: "Pay and complete",
    description: "Pay after they accept, then confirm the event went well and leave a review",
    mockStage: "pay",
    screenshotAlt: "Secure checkout for an accepted booking on Eventtz",
  },
];

export const FAQ_SECTION = {
  eyebrow: "FAQ",
  title: "Common questions about booking on Eventtz",
} as const;

export const FEATURED_VENDORS_SECTION = {
  eyebrow: "Marketplace",
  title: "Find trusted vendors for any event",
} as const;

export const REVIEWS_SECTION = {
  eyebrow: "Reviews",
  title: "Real events, trusted by clients",
} as const;

export const BROWSE_SECTION = {
  eyebrow: "Discover",
  title: "Start with what you need",
  description: "Choose a category to find verified vendors",
} as const;
