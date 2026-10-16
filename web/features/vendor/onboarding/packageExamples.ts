export type PackageExample = {
  name: string;
  price: string;
  included: string;
};

export type ServicePackageExamples = {
  serviceKey: string;
  label: string;
  intro: string;
  examples: PackageExample[];
};

export const PACKAGE_EXAMPLES_BY_SERVICE: Record<string, ServicePackageExamples> = {
  catering: {
    serviceKey: "catering",
    label: "Catering / food",
    intro: "List each menu or platter as its own package with quantities.",
    examples: [
      {
        name: "Small Chops Package",
        price: "£40",
        included: "10 spring rolls, 10 samosas, 10 puff-puff and 5 peppered gizzard.",
      },
      {
        name: "Small Chops – Large Pack",
        price: "£70",
        included: "20 spring rolls, 20 samosas, 20 puff-puff and 10 peppered gizzard.",
      },
    ],
  },
  baking: {
    serviceKey: "baking",
    label: "Cakes & baking",
    intro: "Separate cakes, tiers, or serving sizes into distinct packages.",
    examples: [
      {
        name: "Celebration Cake",
        price: "£120",
        included: "Two-tier cake, serves 30, standard flavours, delivery within 10 miles.",
      },
      {
        name: "Cupcake Box",
        price: "£45",
        included: "24 cupcakes, two flavour choices, standard decoration.",
      },
    ],
  },
  makeup: {
    serviceKey: "makeup",
    label: "Makeup & beauty",
    intro: "Create a package for each service you offer (bridal, party, bridesmaids, etc.).",
    examples: [
      {
        name: "Silver Bridal Makeup",
        price: "£300",
        included: "Bridal makeup on the day, lashes, skin prep and a touch-up kit.",
      },
      {
        name: "Bridesmaid Makeup",
        price: "£80",
        included: "Full makeup application and lashes.",
      },
    ],
  },
  photography: {
    serviceKey: "photography",
    label: "Photography",
    intro: "Name each shoot type and say how long and what the client receives.",
    examples: [
      {
        name: "Wedding Photography",
        price: "£1,500",
        included: "Up to 8 hours, edited digital photos and an online gallery.",
      },
      {
        name: "Birthday Photography",
        price: "£500",
        included: "Up to 4 hours and edited digital photos.",
      },
    ],
  },
  rentals: {
    serviceKey: "rentals",
    label: "Rentals & hire",
    intro: "Charge per item so clients can pick how many they need, or list a fixed bundle.",
    examples: [
      {
        name: "Chair hire",
        price: "£2 each",
        included: "White folding chairs, 3-day hire, delivery and collection within 10 miles.",
      },
      {
        name: "Table hire",
        price: "£10 each",
        included: "6ft round tables, seats up to 8, 3-day hire, delivery and collection included.",
      },
    ],
  },
  event_planning: {
    serviceKey: "event_planning",
    label: "Event planning",
    intro: "List each planning tier or coordination package with what's included.",
    examples: [
      {
        name: "Full Day Coordination",
        price: "£800",
        included: "Timeline planning, vendor liaison, on-the-day management up to 10 hours.",
      },
      {
        name: "Partial Planning",
        price: "£450",
        included: "Vendor recommendations, budget guidance, and checklist support for 4 weeks.",
      },
    ],
  },
  decor: {
    serviceKey: "decor",
    label: "Decor & styling",
    intro: "Each decor package should list styling elements and coverage.",
    examples: [
      {
        name: "Gold Decor Package",
        price: "£450",
        included: "Backdrop, balloon garland, and table centrepieces for up to 10 tables.",
      },
      {
        name: "Bridal Table Styling",
        price: "£200",
        included: "Head table florals, linen styling, and candle centrepieces.",
      },
    ],
  },
  dj: {
    serviceKey: "dj",
    label: "DJ / music band",
    intro: "Name each DJ set or band package with hours and equipment included.",
    examples: [
      {
        name: "Wedding DJ – 5 hours",
        price: "£600",
        included: "Professional sound system, microphones, and dancefloor lighting.",
      },
      {
        name: "Live Band – 3 sets",
        price: "£1,200",
        included: "Four-piece band, three 45-minute sets, and basic PA.",
      },
    ],
  },
  mc: {
    serviceKey: "mc",
    label: "MC / Alaga",
    intro: "Describe each hosting package and what ceremonies or segments you cover.",
    examples: [
      {
        name: "Wedding MC",
        price: "£350",
        included: "Bilingual hosting, ceremony coordination, and reception announcements.",
      },
      {
        name: "Alaga – traditional segment",
        price: "£250",
        included: "Traditional introductions, gift presentation, and crowd engagement.",
      },
    ],
  },
  hair_styling: {
    serviceKey: "hair_styling",
    label: "Hair styling",
    intro: "Create a package for each service (bridal, bridesmaids, trials, etc.).",
    examples: [
      {
        name: "Bridal Hair Styling",
        price: "£200",
        included: "Consultation, trial, and styling on the wedding day.",
      },
      {
        name: "Bridesmaid Hair",
        price: "£70",
        included: "Occasion styling with basic accessories placement.",
      },
    ],
  },
};

const FALLBACK: ServicePackageExamples = {
  serviceKey: "default",
  label: "Your service",
  intro: "Each package is one option a client can book — with a clear name, price, and what's included.",
  examples: [
    {
      name: "Standard Package",
      price: "£200",
      included: "Describe exactly what the client gets — items, time, headcount, or deliverables.",
    },
  ],
};

export function packageExamplesForServices(servicesOffered: string[]): ServicePackageExamples {
  for (const key of servicesOffered) {
    const hit = PACKAGE_EXAMPLES_BY_SERVICE[key];
    if (hit) return hit;
  }
  return FALLBACK;
}

export function packageNamePlaceholder(serviceKey: string | undefined): string {
  switch (serviceKey) {
    case "catering":
      return "e.g. Small Chops – Large Pack";
    case "baking":
      return "e.g. Two-tier celebration cake";
    case "makeup":
      return "e.g. Bridal makeup – full day";
    case "photography":
      return "e.g. Wedding photography – 8 hours";
    case "rentals":
      return "e.g. Chair hire";
    case "event_planning":
      return "e.g. Full day coordination";
    case "decor":
      return "e.g. Gold decor package";
    case "dj":
      return "e.g. Wedding DJ – 5 hours";
    case "mc":
      return "e.g. Wedding MC package";
    case "hair_styling":
      return "e.g. Bridal hair styling";
    default:
      return "e.g. Gold wedding package";
  }
}

export function packageIncludedPlaceholder(serviceKey: string | undefined): string {
  switch (serviceKey) {
    case "catering":
    case "baking":
      return "List what's included with quantities — e.g. 10 samosas, 10 spring rolls, serves 30 guests.";
    case "makeup":
      return "What's included — e.g. lashes, skin prep, touch-up kit, trial session.";
    case "photography":
      return "Hours covered, edited photos, gallery access, second shooter if included.";
    case "rentals":
      return "What's included — e.g. white folding chairs, 3-day hire, delivery and collection.";
    case "event_planning":
      return "Hours covered, planning scope, vendor liaison, and on-the-day duties.";
    case "decor":
      return "Styling elements, table count, setup time, and teardown if included.";
    case "dj":
      return "Hours, sound system, lighting, and any MC duties if included.";
    case "mc":
      return "Ceremony segments covered, languages, and duration on the day.";
    case "hair_styling":
      return "What's included — e.g. trial, styling on the day, extensions if provided.";
    default:
      return "Exactly what the customer gets — items, duration, headcount, or deliverables.";
  }
}
