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

export type GalleryVideo = {
  src: string;
  alt: string;
  eventName: string;
};

export const INSPIRATION_SECTION = {
  eyebrow: "Celebrations",
  title: "What people book on Eventtz",
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
        q: "What is Eventtz?",
        a: "Eventtz helps you plan African celebrations in the UK. It is a marketplace where you can find trusted event vendors, message them directly, and book in one place. No more chasing quotes across WhatsApp and email.",
      },
      {
        q: "Which vendors can I find?",
        a: "You can find vendors for baking, catering, photography, makeup, and rentals. Search by category, city, and event date to shortlist people near you who fit your event.",
      },
      {
        q: "Do I need an account to browse?",
        a: "No. You can look through vendor profiles without signing up. When you want to message someone or send a booking request, you will need a free client account.",
      },
      {
        q: "How does booking work?",
        a: "Start on a vendor profile and choose the services you want. Send a request with your event date and venue, then chat with the vendor to confirm the details. When they accept, you pay in the app to secure your date.",
      },
      {
        q: "When do I pay?",
        a: "You pay after the vendor accepts your request, not before. Checkout happens in the app through Stripe. You will always see the full price breakdown before you confirm payment.",
      },
      {
        q: "Is there a service fee?",
        a: `Yes. Eventtz adds a ${SERVICE_FEE_PERCENT_LABEL} service fee on top of the vendor quote at checkout. The full total is shown before you pay, so there are no surprises.`,
      },
      {
        q: "Are vendors vetted?",
        a: "Every vendor completes onboarding before they can list on Eventtz. Our team reviews profiles before they go live in search, so you are browsing approved businesses.",
      },
      {
        q: "Can I message a vendor before booking?",
        a: "Yes. Once you are signed in, you can open a chat from any vendor profile. It is a good way to ask questions and check availability before you send a formal booking request.",
      },
      {
        q: "What kind of events is Eventtz for?",
        a: "Eventtz is for all kinds of celebrations across the UK. That includes weddings, birthdays, traditional and religious events, naming ceremonies, corporate events, and private parties.",
      },
      {
        q: "Can I cancel a booking?",
        a: "You can cancel from your dashboard while a booking is still pending or accepted. If you have already paid and need help with a refund, open a dispute from the booking or get in touch with support.",
      },
      {
        q: "What if something goes wrong?",
        a: "If there is a problem with a booking, you can open a dispute from your bookings page. Our team will review what happened, including your chat history, and help work toward a fair outcome.",
      },
      {
        q: "Can I leave a review?",
        a: "After your event, the vendor marks the booking as complete. You can then leave one honest review on their profile to help other clients choose with confidence.",
      },
    ],
  },
  {
    id: "vendor",
    heading: "For vendors",
    items: [
      {
        q: "How do I join Eventtz?",
        a: "Create a vendor account and work through onboarding step by step. You will add your business details, services, portfolio photos, availability, and connect Stripe so you can get paid.",
      },
      {
        q: "Which services can I list?",
        a: "Right now you can list baking, catering, photography, makeup, or rentals. If your business does not fit those categories yet, choose Other during onboarding and we will add you to our waitlist.",
      },
      {
        q: "When will my profile go live?",
        a: "Your profile goes live after you finish onboarding, complete Stripe verification, and our team approves your listing. We will let you know when you start appearing in client search.",
      },
      {
        q: "Can I set my own prices?",
        a: "Yes. You are in control of your pricing. You can set hourly and daily rates, create packages, and send custom quotes with line items when a client asks for something specific.",
      },
      {
        q: "How do I get paid?",
        a: "Payments go through Stripe Connect, which you set up during onboarding. Once a client has paid and you have marked the booking complete, the money is paid out to your connected account.",
      },
      {
        q: "Does Eventtz take a cut from my earnings?",
        a: `Clients pay a ${SERVICE_FEE_PERCENT_LABEL} Eventtz service fee on top of your quote at checkout. You receive the vendor amount you agreed with the client. The fee is not deducted from your side of the booking.`,
      },
      {
        q: "Can I send quotes to clients?",
        a: "Yes. You can accept incoming requests or send a quote yourself from chat. You can add extras like delivery or travel, or apply a discount, before the client accepts and pays.",
      },
      {
        q: "How do travel and delivery fees work?",
        a: "In your profile, you set where you are based and how far you travel. When you quote a job, you can add delivery or travel as separate line items so the client sees exactly what they are paying for.",
      },
      {
        q: "How do I manage my availability?",
        a: "Use the calendar in your profile to block dates when you are unavailable. When a client sends a request, we check it against your calendar so you are not double-booked.",
      },
      {
        q: "Can I turn down or cancel a booking?",
        a: "Yes. You can decline requests that do not work for you. If plans change after you have accepted, you can cancel from your dashboard and the client will be notified.",
      },
      {
        q: "Will clients leave reviews on my profile?",
        a: "After you mark a booking complete, the client can leave one review on your public profile. Reviews come from real bookings, which helps build trust with new clients.",
      },
      {
        q: "What happens if there is a dispute?",
        a: "Either you or the client can open a dispute from the booking if something goes wrong. Our team reviews the details and may hold the payout until the case is resolved.",
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

export const WHY_EVENTTZ_PILLARS: LandingValuePillar[] = [
  {
    title: "Trusted vendors",
    description:
      "Every vendor completes onboarding and is reviewed by our team before they appear in search.",
    Icon: BadgeCheck,
  },
  {
    title: "One place to plan",
    description:
      "Browse profiles, message vendors, agree quotes, and book without jumping between apps.",
    Icon: MessageCircle,
  },
  {
    title: "Secure payments",
    description:
      "Pay through Stripe after a vendor accepts. You always see the full price breakdown first.",
    Icon: CreditCard,
  },
];

export type LandingVendorBenefit = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const VENDOR_SPOTLIGHT_BENEFITS: LandingVendorBenefit[] = [
  {
    title: "Get discovered",
    description: "Show up when clients search by category, city, and event date across the UK.",
    Icon: MapPin,
  },
  {
    title: "Set your own prices",
    description: "Offer packages, hourly rates, and custom quotes with delivery or travel extras.",
    Icon: Banknote,
  },
  {
    title: "Manage bookings",
    description: "Accept requests, chat in-app, block dates on your calendar, and mark jobs complete.",
    Icon: Calendar,
  },
  {
    title: "Get paid securely",
    description: "Connect Stripe during onboarding and receive payouts after completed bookings.",
    Icon: ShieldCheck,
  },
];

export const TRUST_SAFETY_ITEMS: LandingValuePillar[] = [
  {
    title: "Approved listings",
    description: "We review vendor profiles before they go live so clients browse with confidence.",
    Icon: BadgeCheck,
  },
  {
    title: "Clear pricing",
    description: `Vendor quotes plus a ${SERVICE_FEE_PERCENT_LABEL} Eventtz service fee shown in full before checkout.`,
    Icon: CreditCard,
  },
  {
    title: "Booking history",
    description: "Messages, quotes, and payment status stay tied to each booking in your dashboard.",
    Icon: MessageCircle,
  },
  {
    title: "Dispute support",
    description: "If something goes wrong, either party can open a dispute and our team will review it.",
    Icon: ShieldCheck,
  },
];

export const EXPLORE_NAV_LINKS = [
  { href: "#browse", label: "Categories" },
  { href: "#why-eventtz", label: "Why Eventtz" },
  { href: "#featured", label: "Featured vendors" },
  { href: "#reviews", label: "Reviews" },
  { href: "#inspiration", label: "Celebrations" },
  { href: "#how-it-works", label: "How it works" },
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
