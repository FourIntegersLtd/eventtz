"use client";

import Link from "next/link";
import { formatEventDate } from "@/lib/dateFormat";
import { formatBookingMoneyLabel } from "@/lib/bookingServiceFee";
import type { VendorReferralBookingRow } from "@/lib/vendorReferralsApi";

type SettingsReferralBookingsTableProps = {
  bookings: VendorReferralBookingRow[];
  currentReferralCode?: string;
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function SettingsReferralBookingsTable({
  bookings,
  currentReferralCode = "",
}: SettingsReferralBookingsTableProps) {
  if (bookings.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-neutral-500 sm:px-6">
        When clients book with your referral link, they&apos;ll appear here.
      </p>
    );
  }

  const showCodeColumn = bookings.some(
    (row) => row.referral_code && row.referral_code !== currentReferralCode,
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-5 py-3 sm:px-6">Event</th>
            <th className="px-4 py-3">Client</th>
            {showCodeColumn ? <th className="px-4 py-3">Code used</th> : null}
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Vendor total</th>
            <th className="px-5 py-3 text-right sm:px-6">Fee saved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {bookings.map((row) => (
            <tr key={row.booking_request_id} className="text-neutral-800">
              <td className="px-5 py-3 sm:px-6">
                <Link
                  href={`/vendor/bookings/${row.booking_request_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.event_name || "Booking"}
                </Link>
              </td>
              <td className="px-4 py-3 text-neutral-600">{row.client_display_name || "Client"}</td>
              {showCodeColumn ? (
                <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.referral_code || "-"}</td>
              ) : null}
              <td className="px-4 py-3 tabular-nums text-neutral-600">
                {row.event_date ? formatEventDate(row.event_date) : "-"}
              </td>
              <td className="px-4 py-3 capitalize text-neutral-600">
                {statusLabel(row.booking_status)}
                {row.payment_status ? (
                  <span className="block text-xs text-neutral-400">{statusLabel(row.payment_status)}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatBookingMoneyLabel(row.vendor_portion_gbp)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-emerald-700 sm:px-6">
                {row.referral_fee_discount_gbp > 0
                  ? formatBookingMoneyLabel(row.referral_fee_discount_gbp)
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
