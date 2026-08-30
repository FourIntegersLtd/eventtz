import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Cake,
  ClipboardList,
  Disc3,
  Flower2,
  Mic,
  Package,
  Scissors,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

export type VendorServiceOption = {
  value: string;
  label: string;
};

export type VendorServiceCategory = VendorServiceOption & {
  description: string;
  /** Vendor-facing one-liner for onboarding — what counts as this category. */
  onboardingHint: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  subtopics: string[];
};

export type VendorServiceOnboardingGuideSection = {
  heading?: string;
  body: string;
};

/** Onboardable service keys — keep in sync with backend `VENDOR_SERVICE_KEYS`. */
export const VENDOR_SERVICE_OPTIONS: VendorServiceOption[] = [
  { value: "baking", label: "Baking" },
  { value: "catering", label: "Catering" },
  { value: "photography", label: "Photography" },
  { value: "makeup", label: "Makeup" },
  { value: "rentals", label: "Rentals" },
  { value: "event_planning", label: "Event planner" },
  { value: "decor", label: "Decor" },
  { value: "dj", label: "DJ / music band" },
  { value: "mc", label: "MC / Alaga" },
  { value: "hair_styling", label: "Hair stylist" },
];

export const VENDOR_SERVICE_CATEGORIES: VendorServiceCategory[] = [
  {
    value: "baking",
    label: "Baking",
    description: "Cakes and sweet tables worth showing off",
    onboardingHint: "Cakes, cupcakes, and dessert tables you bake for events.",
    Icon: Cake,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    subtopics: ["Wedding cakes", "Celebration cakes", "Dessert tables"],
  },
  {
    value: "catering",
    label: "Catering",
    description: "Food your guests will remember",
    onboardingHint: "Cooked food, buffets, small chops, and drinks service for events.",
    Icon: UtensilsCrossed,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-500",
    subtopics: ["Weddings", "Corporate", "Bar & drinks"],
  },
  {
    value: "photography",
    label: "Photography",
    description: "See services and prices on every profile before you send a message",
    onboardingHint: "Wedding, party, and event photography — stills and edited galleries.",
    Icon: Camera,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    subtopics: ["Weddings", "Parties", "Corporate"],
  },
  {
    value: "makeup",
    label: "Makeup",
    description: "Bridal, party, and on-the-day looks",
    onboardingHint: "Makeup and glam for bridal, party, and on-the-day looks — not hair styling.",
    Icon: Sparkles,
    iconBg: "bg-fuchsia-100",
    iconColor: "text-fuchsia-500",
    subtopics: ["Bridal", "Parties", "Trials"],
  },
  {
    value: "rentals",
    label: "Rentals",
    description: "Marquees, furniture, chairs, tables, and event hire",
    onboardingHint: "Marquees, chairs, tables, and equipment hire — not styling or décor.",
    Icon: Package,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    subtopics: ["Marquees", "Furniture", "Chairs & tables", "AV hire"],
  },
  {
    value: "event_planning",
    label: "Event planner",
    description: "Coordination, timelines, and on-the-day management",
    onboardingHint: "Full or partial planning, timelines, and on-the-day coordination.",
    Icon: ClipboardList,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    subtopics: ["Full planning", "On-the-day coordination", "Partial planning"],
  },
  {
    value: "decor",
    label: "Decor",
    description: "Balloons, florals, backdrops, and table styling",
    onboardingHint: "Balloons, florals, backdrops, and table styling — not furniture hire.",
    Icon: Flower2,
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    subtopics: ["Balloons", "Florals", "Backdrops", "Tablescapes"],
  },
  {
    value: "dj",
    label: "DJ / music band",
    description: "DJs, live bands, and dancefloor entertainment",
    onboardingHint: "DJs, live bands, and dancefloor music for celebrations.",
    Icon: Disc3,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    subtopics: ["Wedding DJs", "Live bands", "Party DJs"],
  },
  {
    value: "mc",
    label: "MC / Alaga",
    description: "Hosts, MCs, and alagas for your celebration",
    onboardingHint: "Hosts, MCs, and alagas who run the programme and engage guests.",
    Icon: Mic,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    subtopics: ["Wedding MC", "Alaga", "Bilingual hosting"],
  },
  {
    value: "hair_styling",
    label: "Hair stylist",
    description: "Bridal hair, braids, weaves, and occasion styling",
    onboardingHint: "Bridal hair, braids, weaves, and occasion styling — not makeup.",
    Icon: Scissors,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    subtopics: ["Bridal hair", "Braids", "Trials"],
  },
];

export function labelForVendorService(value: string): string {
  return (
    VENDOR_SERVICE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const CATEGORY_CONFUSION_CALLOUT = [
  "Decor vs Rentals — Decor is styling (balloons, florals, backdrops). Rentals is hire (marquees, chairs, tables).",
  "Makeup vs Hair stylist — Pick Makeup for MUA and glam; pick Hair stylist if hair is your main service.",
].join("\n\n");

/** Sections for the step 2 “What we need here” category guide. */
export function vendorServiceOnboardingGuideSections(): VendorServiceOnboardingGuideSection[] {
  const categoryLines = VENDOR_SERVICE_CATEGORIES.map((category) => {
    const examples =
      category.subtopics.length > 0
        ? ` e.g. ${category.subtopics.slice(0, 3).join(", ")}`
        : "";
    return `${category.label} — ${category.onboardingHint}${examples}`;
  });

  return [
    {
      heading: "Choosing a category",
      body: [
        "Pick the option that best matches what clients would search for. You can only choose one.",
        "",
        ...categoryLines,
      ].join("\n"),
    },
    {
      heading: "Easy to mix up",
      body: CATEGORY_CONFUSION_CALLOUT,
    },
  ];
}
