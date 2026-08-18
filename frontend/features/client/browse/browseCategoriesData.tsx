import { VENDOR_SERVICE_CATEGORIES } from "@/lib/vendorServiceCatalog";

export type BrowseCategory = {
  id: string;
  name: string;
  description: string;
  Icon: (typeof VENDOR_SERVICE_CATEGORIES)[number]["Icon"];
  iconBg: string;
  iconColor: string;
  subtopics: string[];
};

export const EVENTTZ_BROWSE_CATEGORIES: BrowseCategory[] = VENDOR_SERVICE_CATEGORIES.map(
  ({ value, label, description, Icon, iconBg, iconColor, subtopics }) => ({
    id: value,
    name: label,
    description,
    Icon,
    iconBg: iconBg.replace("-100", "-500"),
    iconColor: "text-white",
    subtopics,
  }),
);

export const POPULAR_BROWSE_PILLS = [
  { label: "Custom cakes & baking", categoryId: "baking" },
  { label: "Catering & drinks", categoryId: "catering" },
  { label: "Wedding photography", categoryId: "photography" },
  { label: "Makeup & beauty", categoryId: "makeup" },
  { label: "Event decor", categoryId: "decor" },
  { label: "DJ & live band", categoryId: "dj" },
  { label: "MC & alaga", categoryId: "mc" },
  { label: "Hair styling", categoryId: "hair_styling" },
  { label: "Event planning", categoryId: "event_planning" },
  { label: "Rentals & hire", categoryId: "rentals" },
] as const;
