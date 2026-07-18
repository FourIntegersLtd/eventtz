import Link from "next/link";
import { Calendar, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { portalPanelShell } from "@/components/portal-shell/portalTheme";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingPricingBreakdown } from "@/features/bookings/BookingPricingBreakdown";
import type {
  BookingDetailAction,
  BookingDetailSlots,
  BookingDetailViewModel,
} from "@/features/bookings/bookingViewModel";

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
      <div className={`${portalPanelShell} sm:p-8`}>
        <SkeletonDetailHeader />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${portalPanelShell} sm:p-8`}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={`${portalPanelShell} items-center justify-center`}>
        <EmptyState title={emptyTitle} className="border-0" />
      </div>
    );
  }

  const location = formatBookingLocation(booking.venuePostcode, booking.venueAddress);
  const hasFooter = footerActions.length > 0 || Boolean(slots.footerSection);

  return (
    <div className={`${portalPanelShell} sm:p-8`}>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-semibold text-neutral-900">{booking.eventName}</h2>
          <p className="mt-1 text-xs text-neutral-500">{booking.timelineLabel}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            {booking.paymentStatus ? (
              <PaymentStatusBadge status={booking.paymentStatus} />
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
        <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      <div className="scroll-pane mt-6 min-h-0 flex-1 space-y-8 px-1 pb-6 sm:mt-8">
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
            {/* Soft tint so messages / CTA stands out */}
            <div className="flex flex-col gap-3 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                <div>
                  <dt className="text-[13px] text-neutral-500">Messages</dt>
                  <dd className="mt-0.5 text-sm text-neutral-700">{booking.messagesHint}</dd>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={booking.onOpenChat}>
                {booking.messagesActionLabel}
              </Button>
            </div>
          </dl>
        </section>

        <section>
          <BookingPricingBreakdown
            quoteTotalLabel={booking.totalLabel}
            pricing={booking.pricing ?? undefined}
            variant={booking.pricingVariant}
            lineItems={booking.lineItems}
            compareTotalLabel={booking.compareTotalLabel}
          />
          {booking.paidAtLabel ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50/70 px-5 py-3.5 text-sm ring-1 ring-emerald-200/70">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200/50 text-emerald-700">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="font-semibold text-emerald-900">Paid</span>
              <span className="text-neutral-600">recorded {booking.paidAtLabel}</span>
            </div>
          ) : null}
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

        {hasFooter ? (
          <section className="border-t border-neutral-100 pt-6">
            {slots.footerSection}
            {footerActions.length > 0 ? (
              <div className={`flex flex-wrap justify-end gap-2 ${slots.footerSection ? "mt-4" : ""}`}>
                {footerActions.map((a) => (
                  <ActionButton key={a.key} action={a} />
                ))}
              </div>
            ) : null}
            {footerNote ? <p className="mt-2 text-right text-xs text-neutral-500">{footerNote}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
