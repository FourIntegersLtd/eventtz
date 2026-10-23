import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { CLIENT_BOOKINGS_PAGE_SIZE, type ClientBookingsListParamsWithPage } from "@/lib/clientBookingsApi";

export type PaymentChip = "all" | "paid" | "refunds" | "failed";

export const PAYMENT_FILTER_OPTIONS: EzFilterOption<PaymentChip>[] = [
  { id: "all", title: "All payments" },
  { id: "paid", title: "Paid", subtitle: "Paid or payout released" },
  { id: "refunds", title: "Refunds", subtitle: "Full or partial refunds" },
  { id: "failed", title: "Failed / unpaid", subtitle: "Unpaid or pending checkout" },
];

/** The one chip-to-status mapping; the server filters on it so pages and totals stay true. */
export const PAYMENT_CHIP_STATUSES: Record<Exclude<PaymentChip, "all">, readonly string[]> = {
  paid: ["paid", "payout_released"],
  refunds: ["refunded", "partially_refunded"],
  failed: ["unpaid", "pending"],
};

export function paymentChipLabel(chip: PaymentChip): string {
  return PAYMENT_FILTER_OPTIONS.find((option) => option.id === chip)?.title ?? "Filter";
}

/** Query for one page of the client's payment history under a chip. */
export function clientPaymentsListParams(chip: PaymentChip, offset: number): ClientBookingsListParamsWithPage {
  return {
    group: "all",
    exclude_payment_status: "unpaid",
    ...(chip === "all" ? {} : { payment_status: PAYMENT_CHIP_STATUSES[chip].join(",") }),
    offset,
    limit: CLIENT_BOOKINGS_PAGE_SIZE,
  };
}
