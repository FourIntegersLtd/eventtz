"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import { TablePagination } from "@/components/ui/TablePagination";
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
  const [rows, setRows] = useState<ClientBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [chip, setChip] = useState<PaymentChip>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchClientBookingsPage(clientPaymentsListParams(chip, offset));
      setRows(page.bookings);
      setTotal(page.total);
    } catch {
      setError("Could not load payment history.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [chip, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  /** A new filter starts from the first page of its own results. */
  const selectChip = (next: PaymentChip) => {
    setChip(next);
    setOffset(0);
  };

  if (loading && rows.length === 0) {
    return <p className="ez-small">Loading payment history…</p>;
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  if (total === 0 && chip === "all") {
    return (
      <LottieEmptyPanel
        variant="payments"
        title="No paid bookings yet"
        description="When you pay for a booking, it will show up here."
      />
    );
  }

  return (
    <div className="ez-stack ez-stack--lg">
      <EzListFilterToolbar
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={chip !== "all" ? 1 : 0}
        summary={
          chip !== "all"
            ? { label: paymentChipLabel(chip), onClear: () => selectChip("all") }
            : null
        }
      />

      <EzFilterOptionsModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter payment history"
        description="Show all paid bookings or narrow by how money moved."
        options={PAYMENT_FILTER_OPTIONS}
        value={chip}
        onChange={selectChip}
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
              <ReceiptActions
                bookingId={booking.booking_request_id}
                documentType="client_payment_receipt"
                compact
              />
            ) : null}
          </div>
        ))}
      </div>

      <TablePagination
        offset={offset}
        limit={CLIENT_BOOKINGS_PAGE_SIZE}
        total={total}
        pageRowCount={rows.length}
        loading={loading}
        onPrevious={() => setOffset(Math.max(0, offset - CLIENT_BOOKINGS_PAGE_SIZE))}
        onNext={() => setOffset(offset + CLIENT_BOOKINGS_PAGE_SIZE)}
      />
    </div>
  );
}
