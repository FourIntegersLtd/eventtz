"use client";

import Link from "next/link";
import { useState } from "react";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import { PaymentsListSection } from "@/features/receipts/PaymentsListSection";
import { useServerList } from "@/lib/useServerList";
import { ReceiptActions } from "@/features/receipts/ReceiptActions";
import { hasPaymentReceipt } from "@/lib/receiptsApi";
import {
  clientPaymentsListParams,
  PAYMENT_FILTER_OPTIONS,
  paymentChipLabel,
  type PaymentChip,
} from "@/features/client/payments/paymentChips";
import {
  CLIENT_BOOKINGS_PAGE_SIZE,
  fetchClientBookingsPage,
  type ClientBookingListItem,
} from "@/lib/clientBookingsApi";
import { formatEventDate } from "@/lib/dateFormat";

export function ClientPaymentsView() {
  const [chip, setChip] = useState<PaymentChip>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  // The api filters and pages; a new chip returns to the first page (useServerList resets the offset).
  const list = useServerList<ClientBookingListItem, { chip: PaymentChip }>({
    pageSize: CLIENT_BOOKINGS_PAGE_SIZE,
    errorMessage: "Could not load payment history.",
    filters: { chip },
    fetchPage: async ({ offset, filters }) => {
      const page = await fetchClientBookingsPage(clientPaymentsListParams(filters.chip, offset));
      return { items: page.bookings, total: page.total };
    },
  });
  const rows = list.items;
  const total = list.total;

  return (
    <PaymentsListSection
      list={{ ...list, itemCount: rows.length }}
      loadingLabel="Loading payment history…"
      isEmpty={total === 0 && chip === "all"}
      empty={
        <LottieEmptyPanel
          variant="payments"
          title="No paid bookings yet"
          description="When you pay for a booking, it will show up here."
        />
      }
    >
      <>
        <EzListFilterToolbar
          onOpenFilter={() => setFilterOpen(true)}
          activeFilterCount={chip !== "all" ? 1 : 0}
          summary={chip !== "all" ? { label: paymentChipLabel(chip), onClear: () => setChip("all") } : null}
        />

        <EzFilterOptionsModal
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Filter payment history"
          description="Show all paid bookings or narrow by how money moved."
          options={PAYMENT_FILTER_OPTIONS}
          value={chip}
          onChange={setChip}
          listAriaLabel="Payment history filter"
          resetValue="all"
          resetLabel="Show all"
        />

        {total === 0 ? <p className="ez-small">No payments match this filter.</p> : null}

        <div className="ez-list">
          {rows.map((booking) => (
            <div key={booking.booking_request_id} className="ez-list-row">
              <div className="ez-list-row__main">
                <Link href={`/client/bookings/${booking.booking_request_id}`} className="ez-h3">
                  {booking.event_name}
                </Link>
                <span className="ez-caption">
                  {booking.vendor_display_name}
                  {booking.event_date ? ` · ${formatEventDate(booking.event_date)}` : ""}
                </span>
              </div>
              <span className="ez-list-row__status">
                <PaymentStatusBadge status={booking.payment_status} />
              </span>
              <span className="ez-strong ez-num">{booking.client_total_label ?? booking.total_label}</span>
              {hasPaymentReceipt(booking.payment_status) ? (
                <ReceiptActions bookingId={booking.booking_request_id} documentType="client_payment_receipt" compact />
              ) : null}
            </div>
          ))}
        </div>
      </>
    </PaymentsListSection>
  );
}
