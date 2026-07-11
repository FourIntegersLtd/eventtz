import type { LucideIcon } from "lucide-react";
import {
  Camera,
  UtensilsCrossed,
  Cake,
  Sparkles,
  Package,
} from "lucide-react";

export type BrowseCategory = {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  subtopics: string[];
};

export const EVENTTZ_BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: "baking",
    name: "Baking",
    description: "Cakes, desserts, sweet tables.",
    Icon: Cake,
    iconBg: "bg-orange-500",
    iconColor: "text-white",
    subtopics: ["Wedding cakes", "Celebration cakes", "Dessert tables"],
  },
  {
    id: "catering",
    name: "Catering",
    description: "Canapés through to full menus.",
    Icon: UtensilsCrossed,
    iconBg: "bg-rose-500",
    iconColor: "text-white",
    subtopics: ["Weddings", "Corporate", "Bar & drinks"],
  },
  {
    id: "photography",
    name: "Photography",
    description: "Weddings, parties, corporate.",
    Icon: Camera,
    iconBg: "bg-amber-500",
    iconColor: "text-white",
    subtopics: ["Weddings", "Parties", "Corporate"],
  },
  {
    id: "makeup",
    name: "Makeup",
    description: "Bridal and occasion looks.",
    Icon: Sparkles,
    iconBg: "bg-fuchsia-500",
    iconColor: "text-white",
    subtopics: ["Bridal", "Parties", "Trials"],
  },
  {
    id: "rentals",
    name: "Rentals",
    description: "Furniture, décor, marquees, and kit for your event.",
    Icon: Package,
    iconBg: "bg-violet-600",
    iconColor: "text-white",
    subtopics: ["Furniture & décor", "Marquees", "AV & lighting", "Corporate"],
  },
];

export const POPULAR_BROWSE_PILLS = [
  { label: "Custom cakes & baking", categoryId: "baking" },
  { label: "Catering & drinks", categoryId: "catering" },
  { label: "Wedding photography", categoryId: "photography" },
  { label: "Makeup & beauty", categoryId: "makeup" },
  { label: "Rentals", categoryId: "rentals" },
] as const;
