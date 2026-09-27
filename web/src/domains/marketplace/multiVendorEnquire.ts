/**
 * One shared brief sent as a separate booking request per vendor.
 * Payloads reuse `buildBookingRequestPayload`: package ids and quantities only.
 * The cheapest listed package is preselected, matching the baseline picker.
 */
import type { CreateBookingRequestBody } from "./api";
import {
  buildBookingRequestPayload,
  type BookingRequestFormInput,
} from "./bookingRequestPayload";
import type { ClientSearchContext } from "./marketplaceSearchParams";
import { buildBrowsePricingOptions } from "./browsePricingBuild";
import {
  bookingQuantitiesPayload,
  type BookingQuantityOption,
  type BrowsePricingOption,
} from "./vendorBrowseDetailModel";

/** A vendor row with the onboarding payload the package list is read from. */
export type MultiVendorRow = {
  user_id: string;
  profile_form_data?: Record<string, unknown> | null;
};

/** One vendor's chosen package, ready to become a request body. */
export type MultiVendorPackageChoice = {
  userId: string;
  optionId: string;
  quantityOptions: readonly BookingQuantityOption[];
  quantity?: number;
};

export const REQUESTS_NOT_SENT = "Requests not sent";

/** Shown when some of the sequential posts failed. */
export function partialRequestsSent(sent: number, total: number): string {
  return `${sent} of ${total} requests sent`;
}

export type MultiVendorSendOutcome =
  | { kind: "none"; message: typeof REQUESTS_NOT_SENT }
  | { kind: "partial"; message: string }
  | { kind: "all" };

/**
 * 0 sent is a full failure. Fewer than `total` is partial. Every request
 * succeeding is all-success, which closes the dialog.
 */
export function summarizeMultiVendorSend(sent: number, total: number): MultiVendorSendOutcome {
  if (sent <= 0 || total <= 0) {
    return { kind: "none", message: REQUESTS_NOT_SENT };
  }
  if (sent < total) {
    return { kind: "partial", message: partialRequestsSent(sent, total) };
  }
  return { kind: "all" };
}

/** Business name, or "Vendor" when the payload has none. */
export function vendorDisplayName(vendor: MultiVendorRow): string {
  const payload = vendor.profile_form_data ?? {};
  const name = typeof payload.businessName === "string" ? payload.businessName.trim() : "";
  return name || "Vendor";
}

/** Bookable packages for one vendor. Display prices stay on these objects. */
export function pricingOptionsForVendor(vendor: MultiVendorRow): BrowsePricingOption[] {
  return buildBrowsePricingOptions(vendor);
}

/** Cheapest priced package, otherwise the first listed option. */
export function defaultOptionIdForVendor(vendor: MultiVendorRow): string | null {
  const options = pricingOptionsForVendor(vendor);
  const priced = options.filter(
    (option) => option.unitPriceGbp != null && Number.isFinite(option.unitPriceGbp),
  );
  if (priced.length === 0) return options[0]?.id ?? null;
  return priced.reduce((best, option) =>
    (option.unitPriceGbp ?? Infinity) < (best.unitPriceGbp ?? Infinity) ? option : best,
  ).id;
}

/** One preselected package id per vendor that has any option. */
export function initialOptionSelections(vendors: readonly MultiVendorRow[]): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const vendor of vendors) {
    const optionId = defaultOptionIdForVendor(vendor);
    if (optionId) selected[vendor.user_id] = optionId;
  }
  return selected;
}

/** Minimum quantity for a per-unit package. Fixed packages use 1. */
export function defaultQuantityForOption(option: BrowsePricingOption | undefined): number {
  if (!option) return 1;
  return option.pricingMode === "per_unit" ? option.minQuantity : 1;
}

/** Starting quantities, only for vendors whose preselected package is per-unit. */
export function initialQuantitiesForVendors(
  vendors: readonly MultiVendorRow[],
  selectedOptionByVendorId: Record<string, string>,
): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const vendor of vendors) {
    const optionId = selectedOptionByVendorId[vendor.user_id];
    if (!optionId) continue;
    const option = pricingOptionsForVendor(vendor).find((entry) => entry.id === optionId);
    if (option?.pricingMode === "per_unit") {
      quantities[vendor.user_id] = defaultQuantityForOption(option);
    }
  }
  return quantities;
}

/** Package name and a display price. The price is not part of the request. */
export function optionLabel(option: BrowsePricingOption): string {
  const price =
    option.priceDisplay != null && option.priceDisplay !== ""
      ? `£${option.priceDisplay}${option.priceSuffix ? ` ${option.priceSuffix}` : ""}`
      : "Quote on request";
  return `${option.heading} - ${price}`;
}

/** Shown when a selected vendor has nothing the client can book. */
export function missingPackageMessage(vendorName: string): string {
  return `${vendorName} has no bookable packages yet. Remove them and try again.`;
}

/**
 * Lists the vendors whose calendar rejects the dates.
 * Null when the date is empty or every vendor can take it.
 */
export function calendarConflictMessage(
  vendors: readonly MultiVendorRow[],
  conflictUserIds: readonly string[],
  eventDate: string,
): string | null {
  if (conflictUserIds.length === 0 || !eventDate.trim()) return null;
  const names = vendors
    .filter((vendor) => conflictUserIds.includes(vendor.user_id))
    .map(vendorDisplayName);
  return `These dates don't match availability for: ${names.join(", ")}. Adjust the dates or remove those vendors.`;
}

/**
 * One create-booking body per vendor, in order.
 * `batchSize`, `batchIndex`, and `source` are added to the search context.
 * An existing context source wins over `enquirySource`.
 */
export function buildMultiVendorEnquirePayloads(args: {
  form: BookingRequestFormInput;
  choices: readonly MultiVendorPackageChoice[];
  clientSearchContext?: ClientSearchContext | null;
  enquirySource: "multi" | "planner";
  eventId?: string | null;
}): CreateBookingRequestBody[] {
  const batchSize = args.choices.length;
  const source = args.clientSearchContext?.source ?? args.enquirySource;
  return args.choices.map((choice, index) => {
    const quantities = bookingQuantitiesPayload(
      [choice.optionId],
      choice.quantityOptions,
      choice.quantity == null ? {} : { [choice.optionId]: choice.quantity },
    );
    return buildBookingRequestPayload(args.form, {
      vendorUserId: choice.userId,
      selectedOptionIds: [choice.optionId],
      quantities,
      quantityOptions: choice.quantityOptions,
      clientSearchContext: {
        ...(args.clientSearchContext ?? {}),
        batchSize,
        batchIndex: index,
        source,
      },
      eventId: args.eventId ?? null,
    });
  });
}
