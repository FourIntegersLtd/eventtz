"use client";

import Link from "next/link";
import { formatEventDate } from "@/lib/dateFormat";
import { formatBookingMoneyLabel } from "@/lib/bookingServiceFee";
import type { VendorReferralBookingRow } from "@/lib/vendorReferralsApi";

type VendorReferralBookingsTableProps = {
  bookings: VendorReferralBookingRow[];
  totalBookings: number;
  totalSavingsGbp: number;
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function VendorReferralBookingsTable({
  bookings,
  totalBookings,
  totalSavingsGbp,
}: VendorReferralBookingsTableProps) {
  return (
    <div className="mt-6 border-t border-neutral-100 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-neutral-900">Referral bookings</h3>
        <p className="text-sm text-neutral-600">
          {totalBookings} booking{totalBookings === 1 ? "" : "s"} ·{" "}
          {formatBookingMoneyLabel(totalSavingsGbp)} saved for clients
        </p>
      </div>

      {bookings.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          When clients book with your referral link, they&apos;ll appear here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Vendor total</th>
                <th className="px-4 py-3 text-right">Fee saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bookings.map((row) => (
                <tr key={row.booking_request_id} className="text-neutral-800">
                  <td className="px-4 py-3">
                    <Link
                      href={`/vendor/bookings/${row.booking_request_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.event_name || "Booking"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {row.client_display_name || "Client"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-600">
                    {row.event_date ? formatEventDate(row.event_date) : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {statusLabel(row.booking_status)}
                    {row.payment_status ? (
                      <span className="block text-xs text-neutral-400">
                        {statusLabel(row.payment_status)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBookingMoneyLabel(row.vendor_portion_gbp)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {row.referral_fee_discount_gbp > 0
                      ? formatBookingMoneyLabel(row.referral_fee_discount_gbp)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
