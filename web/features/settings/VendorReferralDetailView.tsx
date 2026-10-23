"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatEventDate } from "@/lib/dateFormat";
import { formatGbp } from "@/lib/money";
import { isHttpStatus } from "@/lib/api-errors";
import {
  fetchVendorReferralBookings,
  type VendorReferralBookingRow,
} from "@/lib/vendorReferralsApi";

type VendorReferralDetailViewProps = {
  bookingId: string;
};

/** One referral booking, loaded from the vendor referral list. */
export function VendorReferralDetailView({ bookingId }: VendorReferralDetailViewProps) {
  const [row, setRow] = useState<VendorReferralBookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchVendorReferralBookings()
      .then((response) => {
        if (cancelled) return;
        const match = response.bookings.find((booking) => booking.booking_request_id === bookingId) ?? null;
        setRow(match);
        setMissing(match == null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isHttpStatus(err, 404)) {
          setMissing(true);
          return;
        }
        setError("Could not load this referral.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading) {
    return <LoadingState label="Loading referral…" variant="centered" />;
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  if (missing || !row) {
    return (
      <EmptyState
        lottie="notFound"
        title="Referral not found"
        description="This booking is not on your referral list."
        action={
          <ButtonLink variant="secondary" href="/vendor/settings?tab=referrals">
            Back to referrals
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Referrals"
        title={row.client_display_name || "Referral"}
        description={row.event_name}
        actions={
          <ButtonLink variant="ghost" href="/vendor/settings?tab=referrals">
            All referrals
          </ButtonLink>
        }
      />
      <Card>
        <Card.Body>
          <div className="ez-lines">
            <div className="ez-lines__row">
              <span>Client</span>
              <span>{row.client_display_name || "-"}</span>
            </div>
            <div className="ez-lines__row">
              <span>Event</span>
              <span>{row.event_name}</span>
            </div>
            <div className="ez-lines__row">
              <span>Event date</span>
              <span>{row.event_date ? formatEventDate(row.event_date) : "-"}</span>
            </div>
            <div className="ez-lines__row">
              <span>Booking</span>
              <span>{row.booking_status.replace(/_/g, " ")}</span>
            </div>
            <div className="ez-lines__row">
              <span>Payment</span>
              <span>{row.payment_status.replace(/_/g, " ")}</span>
            </div>
            <div className="ez-lines__row">
              <span>Code</span>
              <span>{row.referral_code || "-"}</span>
            </div>
            <div className="ez-lines__row">
              <span>Your price</span>
              <span>{formatGbp(row.vendor_portion_gbp, { roundToPence: true })}</span>
            </div>
            <div className="ez-lines__total">
              <span>Client saved</span>
              <span>{formatGbp(row.referral_fee_discount_gbp, { roundToPence: true })}</span>
            </div>
          </div>
        </Card.Body>
        <Card.Footer>
          <ButtonLink variant="secondary" href={`/vendor/bookings/${row.booking_request_id}`}>
            Open booking
          </ButtonLink>
        </Card.Footer>
      </Card>
    </div>
  );
}
