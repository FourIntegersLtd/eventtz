"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";
import { useAdminBookingDetail } from "@/features/admin/bookings/useAdminBookingDetail";
import {
  BookingPricingBreakdown,
  type BookingLineItemRow,
  type BookingPricing,
} from "@/features/bookings/BookingPricingBreakdown";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import { patchBookingPaymentFields } from "@/lib/adminPlatformApi";

type Props = {
  bookingId: string;
};

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${adminCard} p-5`}>
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asPricing(v: unknown): BookingPricing | null {
  const p = asRecord(v);
  if (!p || typeof p.client_total_label !== "string") return null;
  return p as unknown as BookingPricing;
}

function mapAdminLineItems(items: unknown[]): BookingLineItemRow[] {
  return items.map((item, i) => {
    const row = asRecord(item) ?? {};
    return {
      id: String(row.id ?? `line-${i}`),
      heading: String(row.heading ?? row.label ?? row.name ?? `Line ${i + 1}`),
      unit_price_gbp: typeof row.unit_price_gbp === "number" ? row.unit_price_gbp : null,
      description: row.description != null ? String(row.description) : null,
      feature_lines: Array.isArray(row.feature_lines)
        ? row.feature_lines.map((x) => String(x))
        : undefined,
      timeline_line: row.timeline_line != null ? String(row.timeline_line) : null,
    };
  });
}

function asClientReview(v: unknown): BookingReviewDisplay | null {
  const r = asRecord(v);
  if (!r || typeof r.rating !== "number") return null;
  return {
    id: String(r.id ?? ""),
    rating: r.rating,
    body: String(r.body ?? ""),
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}

export function AdminBookingDetailView({ bookingId }: Props) {
  const { booking, loading, error, reload } = useAdminBookingDetail(bookingId);
  const [pi, setPi] = useState("");
  const [ch, setCh] = useState("");
  const [amt, setAmt] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  if (loading) {
    return <AdminLoadingState label="Loading booking…" rows={3} />;
  }

  if (error || !booking) {
    return <AdminErrorBanner message={error ?? "Not found."} />;
  }

  const lineItems = mapAdminLineItems(asArray(booking.line_items));
  const reviewVendor = asClientReview(booking.review_vendor);
  const pricing = asPricing(booking.pricing);
  const eventName = String(booking.event_name ?? "Booking");
  const quoteTotalLabel = String(booking.total_label ?? booking.client_total_label ?? "—");

  return (
    <div className="space-y-6">
      <nav className="text-sm text-neutral-600">
        <Link href="/admin/commerce?tab=bookings" className="text-primary hover:underline">
          Commerce
        </Link>
        <span className="mx-2 text-neutral-400">/</span>
        <Link href="/admin/commerce?tab=bookings" className="text-primary hover:underline">
          Bookings
        </Link>
        <span className="mx-2 text-neutral-400">/</span>
        <span className="text-neutral-900">{eventName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailSection title="Summary">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" value={<StatusBadge status={String(booking.status ?? "")} />} />
            <Field label="Event" value={eventName} />
            <Field label="Event date" value={String(booking.event_date ?? "—")} />
            <Field
              label="Event postcode"
              value={booking.event_postcode != null ? String(booking.event_postcode) : "—"}
            />
            <Field
              label="Payment status"
              value={
                <PaymentStatusBadge status={String(booking.payment_status ?? "unpaid")} />
              }
            />
            <Field
              label="Paid at"
              value={booking.paid_at != null ? String(booking.paid_at) : "—"}
            />
          </dl>
        </DetailSection>

        <DetailSection title="Parties">
          <dl className="grid gap-4">
            <Field label="Client" value={String(booking.client_email ?? "—")} />
            <Field
              label="Vendor"
              value={
                <>
                  {String(booking.vendor_display_name ?? "")}{" "}
                  <span className="text-neutral-500">({String(booking.vendor_email ?? "")})</span>
                </>
              }
            />
          </dl>
        </DetailSection>
      </div>

      <DetailSection title="Pricing breakdown">
        <BookingPricingBreakdown
          quoteTotalLabel={quoteTotalLabel}
          pricing={pricing}
          variant="client"
          lineItems={lineItems}
        />
      </DetailSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailSection title="Payment admin">
          <p className="text-xs text-neutral-500">
            Optional Stripe fields for audit; webhooks may populate these automatically.
          </p>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPayErr(null);
              setPayBusy(true);
              try {
                const n = amt === "" ? null : Number(amt);
                if (amt !== "" && (n === null || Number.isNaN(n))) {
                  setPayErr("Enter a valid amount or leave blank.");
                  return;
                }
                await patchBookingPaymentFields(bookingId, {
                  stripe_payment_intent_id: pi.trim() || null,
                  stripe_charge_id: ch.trim() || null,
                  payment_amount_gbp: n,
                });
                setPi("");
                setCh("");
                setAmt("");
                await reload();
              } catch {
                setPayErr("Could not save payment fields.");
              } finally {
                setPayBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              <span className="text-neutral-600">Payment intent id</span>
              <input
                value={pi}
                onChange={(e) => setPi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="pi_…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-600">Charge id</span>
              <input
                value={ch}
                onChange={(e) => setCh(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="ch_…"
              />
            </label>
            <label className="block w-full max-w-xs text-sm">
              <span className="text-neutral-600">Amount GBP</span>
              <input
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </label>
            {payErr ? <p className="text-sm text-red-700">{payErr}</p> : null}
            <Button type="submit" loading={payBusy}>
              Save payment fields
            </Button>
          </form>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Stored intent"
              value={
                <span className="break-all font-mono text-xs">
                  {String(booking.stripe_payment_intent_id ?? "—")}
                </span>
              }
            />
            <Field
              label="Stored charge"
              value={
                <span className="break-all font-mono text-xs">
                  {String(booking.stripe_charge_id ?? "—")}
                </span>
              }
            />
            <Field
              label="Stored amount GBP"
              value={booking.payment_amount_gbp != null ? String(booking.payment_amount_gbp) : "—"}
            />
          </dl>
        </DetailSection>

        <DetailSection title="Payout">
          <p className="text-xs text-neutral-500">
            Vendor payout releases when both parties confirm completion or via dispute resolution.
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Client confirmed complete"
              value={
                booking.client_completion_confirmed_at != null
                  ? String(booking.client_completion_confirmed_at)
                  : "—"
              }
            />
            <Field
              label="Vendor confirmed complete"
              value={
                booking.vendor_completion_confirmed_at != null
                  ? String(booking.vendor_completion_confirmed_at)
                  : "—"
              }
            />
            <Field
              label="Stripe transfer id"
              value={
                <span className="break-all font-mono text-xs">
                  {String(booking.stripe_transfer_id ?? "—")}
                </span>
              }
            />
            <Field
              label="Payout released at"
              value={booking.payout_released_at != null ? String(booking.payout_released_at) : "—"}
            />
          </dl>
        </DetailSection>
      </div>

      <DetailSection title="Reviews">
        <BookingReviewPanel
          title="Client review of vendor"
          review={reviewVendor}
          emptyLabel="No review yet."
        />
      </DetailSection>
    </div>
  );
}
