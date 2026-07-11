import Link from "next/link";
import { Calendar, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { paymentStatusLabel, paymentStatusToneClasses } from "@/lib/bookingStatusStyles";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingPricingBreakdown } from "@/features/bookings/BookingPricingBreakdown";
import type {
  BookingDetailAction,
  BookingDetailSlots,
  BookingDetailViewModel,
} from "@/features/bookings/bookingViewModel";

function ActionButton({ action }: { action: BookingDetailAction }) {
  return (
    <Button
      variant={action.variant}
      size="md"
      disabled={action.disabled}
      loading={action.loading}
      onClick={action.onClick}
    >
      {action.loading && action.loadingLabel ? action.loadingLabel : action.label}
    </Button>
  );
}

type BookingDetailPanelProps = {
  booking: BookingDetailViewModel | null;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  headerActions?: BookingDetailAction[];
  footerActions?: BookingDetailAction[];
  footerNote?: string;
  slots: BookingDetailSlots;
  emptyTitle: string;
};

/**
 * Pure UI booking detail — client and vendor pages own data fetching,
 * actions, and role-specific slots (quote adjustments, review form). This
 * component only knows how to render a `BookingDetailViewModel`.
 */
export function BookingDetailPanel({
  booking,
  loading,
  error,
  actionError,
  headerActions = [],
  footerActions = [],
  footerNote,
  slots,
  emptyTitle,
}: BookingDetailPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50">
        <SkeletonDetailHeader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50">
        <EmptyState title={emptyTitle} className="border-0" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-semibold text-neutral-900">{booking.eventName}</h2>
          <p className="mt-1 text-xs text-neutral-500">{booking.timelineLabel}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            {booking.paymentStatus ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentStatusToneClasses(booking.paymentStatus)}`}
              >
                {paymentStatusLabel(booking.paymentStatus)}
              </span>
            ) : null}
          </div>
        </div>
        {headerActions.length > 0 ? (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {headerActions.map((a) => (
              <ActionButton key={a.key} action={a} />
            ))}
          </div>
        ) : null}
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      {slots.beforeSections}

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        <section>
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Event &amp; contact</h3>
          <div className="mt-3 grid gap-px overflow-hidden rounded-2xl bg-neutral-200/50 ring-1 ring-neutral-200/50 sm:grid-cols-2">
            <div className="flex gap-4 bg-white px-5 py-4 transition hover:bg-neutral-50">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
              <div>
                <p className="text-xs font-medium text-neutral-500">Event date</p>
                <p className="mt-0.5 text-sm font-medium text-neutral-900">{booking.eventDateLabel}</p>
                {booking.eventEndDateLabel ? (
                  <p className="mt-0.5 text-xs text-neutral-600">to {booking.eventEndDateLabel}</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-4 bg-white px-5 py-4 transition hover:bg-neutral-50">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-500">Location</p>
                <p className="mt-0.5 text-sm font-medium text-neutral-900">{booking.venuePostcode ?? "—"}</p>
                {booking.venueAddress ? (
                  <p className="mt-0.5 text-xs text-neutral-600">{booking.venueAddress}</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-4 bg-white px-5 py-4 transition hover:bg-neutral-50 sm:col-span-2">
              <ExternalLink className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-500">{booking.counterpartyRoleLabel}</p>
                {booking.counterpartyHref ? (
                  <Link
                    href={booking.counterpartyHref}
                    className="mt-0.5 block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {booking.counterpartyName}
                  </Link>
                ) : (
                  <p className="mt-0.5 truncate text-sm font-medium text-neutral-900">
                    {booking.counterpartyName}
                  </p>
                )}
                {booking.counterpartyPhone ? (
                  <p className="mt-0.5 text-xs text-neutral-600">{booking.counterpartyPhone}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 bg-white px-5 py-4 transition hover:bg-neutral-50 sm:col-span-2">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                <div>
                  <p className="text-xs font-medium text-neutral-500">Messages</p>
                  <p className="mt-0.5 text-sm text-neutral-700">
                    {booking.conversationId ? "Continue your conversation" : "No messages yet"}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={booking.onOpenChat}
              >
                {booking.conversationId ? "Open chat" : "Message"}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="mt-3">
            <BookingPricingBreakdown
              quoteTotalLabel={booking.totalLabel}
              pricing={booking.pricing ?? undefined}
              variant={booking.pricingVariant}
              lineItems={booking.lineItems}
            />
            {booking.paidAtLabel ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50/50 px-5 py-4 text-sm ring-1 ring-emerald-200/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200/50 text-emerald-700">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="font-semibold text-emerald-900">Paid</span>
                <span className="text-neutral-600">recorded {booking.paidAtLabel}</span>
              </div>
            ) : null}
          </div>
        </section>

        {booking.notes ? (
          <section>
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{booking.notesLabel}</h3>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-neutral-50 px-5 py-4 text-sm leading-relaxed text-neutral-800 ring-1 ring-neutral-200/50">
              {booking.notes}
            </p>
          </section>
        ) : null}

        {slots.afterSections}

        {slots.disputeSection}
      </div>

      {footerActions.length > 0 ? (
        <div className="mt-auto border-t border-neutral-100 pt-6">
          <div className="flex flex-wrap justify-end gap-2">
            {footerActions.map((a) => (
              <ActionButton key={a.key} action={a} />
            ))}
          </div>
          {footerNote ? <p className="mt-2 text-right text-xs text-neutral-500">{footerNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
