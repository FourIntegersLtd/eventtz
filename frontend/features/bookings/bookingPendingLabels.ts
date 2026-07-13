import type { BookingInitiator } from "@/lib/domain-types";

type PendingLabelInput = {
  status: string;
  initiator?: BookingInitiator;
  hasPriceUpdate?: boolean;
  paymentStatus?: string;
};

/** Role-aware subtext shown under the pending badge in booking lists. */
export function bookingListPendingSubtext(
  role: "client" | "vendor",
  row: PendingLabelInput,
): string | null {
  if (row.status !== "pending") return null;

  const isVendorQuote = row.initiator === "vendor";

  if (role === "client") {
    if (isVendorQuote) return null;
    if (row.hasPriceUpdate) return "New price. Your response needed";
    return "Waiting for vendor";
  }

  if (isVendorQuote) return "Waiting for client";
  if (row.hasPriceUpdate) return "Waiting for client";
  return "Needs your reply";
}
