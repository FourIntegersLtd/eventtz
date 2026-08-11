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
    label: "Rentals & fashion",
    intro: "Each hire item or bundle should be its own bookable package.",
    examples: [
      {
        name: "Chair Hire – 50 pack",
        price: "£150",
        included: "50 white folding chairs, 3-day hire, delivery and collection within 10 miles.",
      },
      {
        name: "Table Rental – 6ft round",
        price: "£25",
        included: "One 6ft round table, seats up to 8, 3-day hire, delivery and collection included.",
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
      return "e.g. Chair hire – 50 pack";
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
      return "List quantity, hire period, and delivery — e.g. 50 chairs, 3-day hire, delivery and collection included.";
    default:
      return "Exactly what the customer gets — items, duration, headcount, or deliverables.";
  }
}
