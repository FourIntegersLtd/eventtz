import type { ExploreVendor } from "@/lib/clientExploreApi";

/** One selectable pricing block — mirrors onboarding packages and/or fixed hourly & daily rates. */
export type BrowsePricingOption = {
  id: string;
  /** Short label for tab buttons */
  tabLabel: string;
  /** Main title (package name, or “Hourly rate” / “Daily rate”) */
  heading: string;
  priceDisplay: string | null;
  compareAtDisplay: string | null;
  /** Parsed GBP amount for sums (null = custom quote / TBC). */
  unitPriceGbp: number | null;
  description: string;
  /** Shown with clock icon — package duration text or inferred line for fixed rates */
  timelineLine: string | null;
  /** Extra bullets (details lines, services, etc.) */
  featureLines: string[];
};

export type BookingLineItem = {
  id: string;
  heading: string;
  unitPriceGbp: number | null;
};

/** Sum selected options for booking UI; handles mixed priced + TBC lines. */
export function buildBookingLineItems(
  options: BrowsePricingOption[],
  selectedIds: string[],
): BookingLineItem[] {
  const set = new Set(selectedIds);
  return options.filter((o) => set.has(o.id)).map((o) => ({
    id: o.id,
    heading: o.heading,
    unitPriceGbp: o.unitPriceGbp,
  }));
}

/** Full line payload for the API so bookings retain package description, bullets, and duration. */
export function bookingLineItemPayloadFromOption(o: BrowsePricingOption): {
  id: string;
  heading: string;
  unit_price_gbp: number | null;
  description: string | null;
  feature_lines: string[];
  timeline_line: string | null;
} {
  const desc = o.description.trim();
  return {
    id: o.id,
    heading: o.heading,
    unit_price_gbp: o.unitPriceGbp,
    description: desc ? desc : null,
    feature_lines: o.featureLines.map((s) => s.trim()).filter(Boolean).slice(0, 25),
    timeline_line: o.timelineLine?.trim() ? o.timelineLine.trim() : null,
  };
}

export function formatBookingTotalGbp(lines: BookingLineItem[]): {
  label: string;
  sumNumeric: number;
  hasTbc: boolean;
} {
  let sum = 0;
  let hasTbc = false;
  for (const l of lines) {
    if (l.unitPriceGbp == null) hasTbc = true;
    else sum += l.unitPriceGbp;
  }
  if (lines.length === 0) {
    return { label: "GBP 0.00", sumNumeric: 0, hasTbc: false };
  }
  const formatted = formatGbp(sum);
  if (hasTbc) {
    return {
      label: sum > 0 ? `GBP ${formatted} + TBC` : "TBC",
      sumNumeric: sum,
      hasTbc: true,
    };
  }
  return { label: `GBP ${formatted}`, sumNumeric: sum, hasTbc: false };
}

function coerceStr(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function parseMoneyNumber(raw: string): number | null {
  const s = raw.replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatGbp(n: number): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

type RawPkg = {
  id: string;
  title: string;
  details: string;
  price: string;
  duration: string;
};

function normalizePackages(payload: Record<string, unknown>): RawPkg[] {
  const raw = payload.packages;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const o = item as Record<string, unknown>;
    const id = coerceStr(o, "id").trim();
    return {
      id: id || `package-${index}`,
      title: coerceStr(o, "title").trim(),
      details: coerceStr(o, "details").trim(),
      price: coerceStr(o, "price").trim(),
      duration: coerceStr(o, "duration").trim(),
    };
  });
}

/** Onboarding: name + price required for a package to count as complete. */
function isCompletePackage(p: RawPkg): boolean {
  return Boolean(p.title && p.price);
}

function discountCompareAt(price: number, pct: number): number | null {
  if (pct <= 0 || pct >= 100) return null;
  return price / (1 - pct / 100);
}

function tabLabelFromTitle(title: string, fallback: string): string {
  const t = title.trim();
  if (!t) return fallback;
  if (t.length <= 18) return t;
  return `${t.slice(0, 17)}…`;
}

function servicesFeatureLines(
  payload: Record<string, unknown>,
): string[] {
  const services = Array.isArray(payload.servicesOffered)
    ? (payload.servicesOffered as unknown[]).map((s) => String(s).trim()).filter(Boolean)
    : [];
  return services.slice(0, 6).map((s) => s);
}

export {
  firstPortfolioImageUrlFromPayload,
  portfolioImageUrlsFromPayload,
} from "@/lib/vendorPortfolioImages";

/**
 * Builds pricing options from the same JSON the vendor saves in onboarding:
 * completed packages first; otherwise fixed hourly and/or daily rates.
 */
export function buildBrowsePricingOptions(vendor: ExploreVendor): BrowsePricingOption[] {
  const p = vendor.payload ?? {};
  const hourly = parseMoneyNumber(coerceStr(p, "hourlyRate"));
  const daily = parseMoneyNumber(coerceStr(p, "dailyRate"));

  const offerDiscounts = p.offerDiscounts === true;
  const discountPct = parseMoneyNumber(coerceStr(p, "discountPercentage")) ?? 0;

  const serviceLines = servicesFeatureLines(p);

  const priceWithCompare = (amount: number | null): {
    priceDisplay: string | null;
    compareAtDisplay: string | null;
  } => {
    if (amount == null) {
      return { priceDisplay: null, compareAtDisplay: null };
    }
    const compare =
      offerDiscounts && discountPct > 0
        ? discountCompareAt(amount, discountPct)
        : null;
    return {
      priceDisplay: formatGbp(amount),
      compareAtDisplay:
        compare != null && Math.abs(compare - amount) > 0.01
          ? formatGbp(compare)
          : null,
    };
  };

  const completePkgs = normalizePackages(p).filter(isCompletePackage);

  if (completePkgs.length > 0) {
    return completePkgs.map((pkg, index) => {
      const priceNum = parseMoneyNumber(pkg.price);
      const { priceDisplay, compareAtDisplay } = priceWithCompare(priceNum);

      const timelineLine = pkg.duration.trim()
        ? pkg.duration.trim()
        : null;

      return {
        id: pkg.id,
        tabLabel: tabLabelFromTitle(pkg.title, `Package ${index + 1}`),
        heading: pkg.title,
        priceDisplay,
        compareAtDisplay,
        unitPriceGbp: priceNum,
        description:
          pkg.details.trim() ||
          "The vendor listed this package with a price — ask what’s included when you get in touch.",
        timelineLine,
        // Match onboarding: checklist reflects services; package “Details” stays in the paragraph above.
        featureLines: serviceLines,
      };
    });
  }

  const options: BrowsePricingOption[] = [];

  if (hourly != null) {
    const { priceDisplay, compareAtDisplay } = priceWithCompare(hourly);
    options.push({
      id: "fixed-hourly",
      tabLabel: "Hourly",
      heading: "Hourly rate",
      priceDisplay,
      compareAtDisplay,
      unitPriceGbp: hourly,
      description:
        "Per-hour rate from this vendor’s pricing step. Scope, hours, and travel are confirmed when you enquire.",
      timelineLine: null,
      featureLines: serviceLines,
    });
  }

  if (daily != null) {
    const { priceDisplay, compareAtDisplay } = priceWithCompare(daily);
    options.push({
      id: "fixed-daily",
      tabLabel: "Daily",
      heading: "Daily rate",
      priceDisplay,
      compareAtDisplay,
      unitPriceGbp: daily,
      description:
        "Per-day rate from this vendor’s pricing step. Coverage and travel are confirmed when you enquire.",
      timelineLine: null,
      featureLines: serviceLines,
    });
  }

  if (options.length > 0) {
    return options;
  }

  return [
    {
      id: "quote",
      tabLabel: "Quote",
      heading: "Request a quote",
      priceDisplay: null,
      compareAtDisplay: null,
      unitPriceGbp: null,
      description:
        "This vendor has not published package prices or fixed hourly/daily rates yet. Send an enquiry to discuss your event.",
      timelineLine: null,
      featureLines: serviceLines.length > 0 ? serviceLines : [],
    },
  ];
}
