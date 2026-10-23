"use client";

import Link from "next/link";
import { Calendar, Check, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Tone } from "@/lib/tone";
import { CopyToClipboardButton } from "@/components/ui/CopyToClipboardButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { BOOKING_OUTCOME_COPY } from "@/features/bookings/bookingConfirmCopy";
import { BookingPricingBreakdown } from "@/features/bookings/BookingPricingBreakdown";
import type {
  BookingDetailAction,
  BookingDetailSlots,
  BookingDetailViewModel,
} from "@/features/bookings/bookingViewModel";
import { paymentStatusLabel } from "@/lib/bookingStatusStyles";
import { shortId } from "@/lib/shortId";
import {
  vendorBookingTrackIndex,
  vendorBookingTrackLabels,
} from "@/features/bookings/vendorBookingTrack";

function formatBookingLocation(
  postcode: string | null,
  address: string | null,
): { primary: string; secondary: string | null } {
  const addr = address?.trim() || null;
  const pc = postcode?.trim() || null;
  if (addr && pc) return { primary: addr, secondary: pc };
  if (addr) return { primary: addr, secondary: null };
  if (pc) return { primary: pc, secondary: null };
  return { primary: "Not added yet", secondary: null };
}

/** Badge colour for the money status, separate from the booking status chip. */
function paymentBadgeTone(status: string): Tone {
  if (status === "paid" || status === "payout_released") return "success";
  if (status === "pending") return "warning";
  if (status === "refunded" || status === "partially_refunded") return "info";
  return "neutral";
}

function statusBadgeTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (normalized.includes("pending")) return "warning";
  if (normalized.includes("complete")) return "success";
  if (normalized.includes("declin") || normalized.includes("cancel")) return "neutral";
  if (normalized.includes("accept")) return "brand";
  return "info";
}

function EzActionButton({ action }: { action: BookingDetailAction }) {
  const variantClass =
    action.variant === "primary"
      ? "ez-btn--primary"
      : action.variant === "destructive"
        ? "ez-btn--danger-quiet"
        : action.variant === "ghost"
          ? "ez-btn--ghost"
          : "ez-btn--secondary";
  return (
    <button
      type="button"
      className={`ez-btn ${variantClass} ez-btn--block`}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.loading && action.loadingLabel ? action.loadingLabel : action.label}
    </button>
  );
}

type VendorBookingDetailEzPanelProps = {
  booking: BookingDetailViewModel | null;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  headerActions?: BookingDetailAction[];
  footerActions?: BookingDetailAction[];
  slots: BookingDetailSlots;
  emptyTitle: string;
  /** Defaults to the vendor bookings index. */
  backHref?: string;
  /** Label on the right-hand action card when `footerSection` is set. */
  footerSectionTitle?: string;
};

/** Vendor booking detail (V17+): real actions and API data in ez layout. */
export function VendorBookingDetailEzPanel({
  booking,
  loading,
  error,
  actionError,
  headerActions = [],
  footerActions = [],
  slots,
  emptyTitle,
  backHref = "/vendor/bookings",
  footerSectionTitle = "Your response",
}: VendorBookingDetailEzPanelProps) {
  if (loading) {
    return (
      <div className="ez-card">
        <div className="ez-card__body">
          <SkeletonDetailHeader />
        </div>
      </div>
    );
  }

  if (error) {
    return <LottieFailurePanel title="Couldn't load booking" description={error} />;
  }

  if (!booking) {
    return <EmptyState title={emptyTitle} className="border-0" variant="bookings" />;
  }

  const trackIndex = vendorBookingTrackIndex(booking.status, booking.paymentStatus);
  const trackLabels = vendorBookingTrackLabels();
  const isRefunded =
    booking.paymentStatus === "refunded" || booking.paymentStatus === "partially_refunded";
  const showDeclinedBanner = booking.status === "declined";
  const showCancelledBanner = booking.status === "cancelled" && !isRefunded;
  const pricing = booking.pricing;
  const location = formatBookingLocation(booking.venuePostcode, booking.venueAddress);

  return (
    <div className="ez-stack ez-stack--lg">
      <Link className="ez-back" href={backHref}>
        All bookings
      </Link>

      <div className="ez-pagehead">
        <div className="ez-pagehead__text">
          <span className="ez-eyebrow">Booking</span>
          <h1 className="ez-h1">{booking.eventName}</h1>
          <p className="ez-body">{booking.timelineLabel}</p>
          <p className="ez-caption">
            Ref {shortId(booking.id)}
            <CopyToClipboardButton text={booking.id} ariaLabel="Copy booking reference" />
          </p>
        </div>
        <div className="ez-pagehead__actions ez-hrow">
          <Badge tone={statusBadgeTone(booking.status)}>{booking.status}</Badge>
          {booking.paymentStatus ? (
            <Badge tone={paymentBadgeTone(booking.paymentStatus)}>{paymentStatusLabel(booking.paymentStatus)}</Badge>
          ) : null}
          {headerActions.map((action) => (
            <EzActionButton key={action.key} action={action} />
          ))}
          {slots.disputeSection}
        </div>
      </div>

      <div className="ez-track" aria-label="Booking progress">
        {trackLabels.map((label, index) => {
          const segClass =
            index < trackIndex
              ? "ez-track__seg ez-track__seg--done"
              : index === trackIndex
                ? "ez-track__seg ez-track__seg--current"
                : "ez-track__seg";
          return (
            <div className={segClass} key={label}>
              {index < trackIndex ? (
                <Check size={14} strokeWidth={2} aria-hidden />
              ) : null}
              {label}
            </div>
          );
        })}
      </div>

      {actionError ? <LottieFailureInline message={actionError} /> : null}

      {showDeclinedBanner || showCancelledBanner ? (
        <LottieFailurePanel
          className="py-4"
          title={showDeclinedBanner ? "Booking declined" : "Booking cancelled"}
          description={
            showDeclinedBanner ? BOOKING_OUTCOME_COPY.declined : BOOKING_OUTCOME_COPY.cancelled
          }
        />
      ) : null}

      <div className="vendor-booking-layout">
        <div className="ez-stack ez-stack--lg">
          {slots.beforeSections}
          <section>
              <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
                Event &amp; contact
              </h3>
              <dl className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
                <div className="grid gap-0 sm:grid-cols-2">
                  <div className="flex gap-3 px-5 py-4 sm:border-r sm:border-neutral-100">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-[13px] text-neutral-500">Event date</dt>
                      <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                        {booking.eventDateLabel}
                      </dd>
                      {booking.eventEndDateLabel ? (
                        <p className="mt-0.5 text-xs text-neutral-500">to {booking.eventEndDateLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-3 border-t border-neutral-100 px-5 py-4 sm:border-t-0">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-[13px] text-neutral-500">Location</dt>
                      <dd
                        className={`mt-0.5 text-sm font-medium ${
                          location.primary === "Not added yet" ? "text-neutral-500" : "text-neutral-900"
                        }`}
                      >
                        {location.primary}
                      </dd>
                      {location.secondary ? (
                        <p className="mt-0.5 text-xs text-neutral-500">{location.secondary}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 px-5 py-4">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-[13px] text-neutral-500">{booking.counterpartyRoleLabel}</dt>
                    <dd className="mt-0.5">
                      {booking.counterpartyHref ? (
                        <Link
                          href={booking.counterpartyHref}
                          className="block truncate text-sm font-medium text-primary hover:underline"
                        >
                          {booking.counterpartyName}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {booking.counterpartyName}
                        </p>
                      )}
                    </dd>
                    {booking.counterpartyPhone ? (
                      <p className="mt-0.5 text-xs text-neutral-500">{booking.counterpartyPhone}</p>
                    ) : null}
                  </div>
                </div>
              </dl>
            </section>

            <section>
              <BookingPricingBreakdown
                quoteTotalLabel={booking.totalLabel}
                pricing={pricing ?? undefined}
                variant={booking.pricingVariant}
                lineItems={booking.lineItems}
                compareTotalLabel={booking.compareTotalLabel}
              />
              {booking.paidAtLabel ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50/70 px-5 py-3.5 text-sm ring-1 ring-emerald-200/70">
                  <span className="font-semibold text-emerald-900">Paid</span>
                  <span className="text-neutral-600">recorded {booking.paidAtLabel}</span>
                </div>
              ) : null}
            </section>

            {booking.notes ? (
              <section>
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {booking.notesLabel}
                </h3>
                <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-neutral-50 px-5 py-4 text-sm leading-relaxed text-neutral-800 ring-1 ring-neutral-200/50">
                  {booking.notes}
                </p>
              </section>
            ) : null}

          {slots.afterSections}
        </div>

        {slots.sideActions || slots.footerSection || footerActions.length > 0 ? (
          <div className="ez-card vendor-booking-actions">
            {slots.sideActions || footerActions.length > 0 ? (
              <div className="ez-card__body ez-stack ez-stack--sm">
                {slots.sideActions}
                {footerActions.map((action) => (
                  <EzActionButton key={action.key} action={action} />
                ))}
              </div>
            ) : null}
            {slots.footerSection ? (
              <>
                <div className="ez-card__head">
                  <span className="ez-h3">{footerSectionTitle}</span>
                </div>
                <div className="ez-card__body ez-stack ez-stack--sm">{slots.footerSection}</div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
