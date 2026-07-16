"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Pause,
  Play,
  RefreshCw,
  Unlock,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";
import { useAdminBookingDetail } from "@/features/admin/bookings/useAdminBookingDetail";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import {
  BookingPricingBreakdown,
  type BookingLineItemRow,
  type BookingPricing,
} from "@/features/bookings/BookingPricingBreakdown";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import type { BookingReviewDisplay } from "@/lib/reviewTypes";
import {
  adminCancelBookingOnBehalf,
  adminCompleteBookingCancellation,
  adminConfirmBookingCompletion,
  adminReleaseBookingPayout,
  adminResetBookingCheckout,
  adminRunBookingMaintenance,
  adminSetBookingSupportHold,
  adminSyncBookingPayment,
  type AdminBookingSupportMeta,
} from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminCancelBookingSchema, parseForm } from "@/lib/validation";

type Props = {
  bookingId: string;
};

const VISIBLE_ACTION_COUNT = 4;

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

function shortId(raw: unknown, head = 10, tail = 6): string | null {
  const s = raw != null ? String(raw).trim() : "";
  if (!s) return null;
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function ExpandableId({ value, label }: { value: unknown; label: string }) {
  const full = value != null ? String(value).trim() : "";
  const [open, setOpen] = useState(false);
  if (!full) return <span className="text-neutral-400">—</span>;
  const compact = shortId(full);
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-sm text-neutral-800 hover:text-primary"
        aria-expanded={open}
      >
        {open ? full : compact}
      </button>
      {!open && full.length > (compact?.length ?? 0) ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-2 text-[12px] font-medium text-primary hover:underline"
        >
          Show full
        </button>
      ) : null}
    </div>
  );
}

function formatTs(v: unknown): React.ReactNode {
  if (v == null) return <span className="text-neutral-400">—</span>;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
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

function asSupport(v: unknown): AdminBookingSupportMeta | null {
  const s = asRecord(v);
  if (!s || !Array.isArray(s.needs_attention)) return null;
  return s as unknown as AdminBookingSupportMeta;
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

type SupportAction = {
  id: string;
  title: string;
  tooltipHint: string;
  confirmBody: string;
  successMessage: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: () => Promise<unknown>;
};

function ActionTooltip({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-52 -translate-x-1/2 rounded-lg bg-neutral-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg group-hover:block"
      >
        {hint}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
      </div>
    </div>
  );
}

function CompactActionRow({
  action,
  busy,
  onSelect,
}: {
  action: SupportAction;
  busy: boolean;
  onSelect: (action: SupportAction) => void;
}) {
  const Icon = action.icon;
  return (
    <ActionTooltip hint={action.tooltipHint}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSelect(action)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-neutral-50 disabled:opacity-50 ${
          action.destructive ? "hover:bg-red-50/60" : ""
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            action.destructive ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-900">
          {action.title}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
      </button>
    </ActionTooltip>
  );
}

function NeedsAttentionBanner({
  support,
  openDispute,
}: {
  support: AdminBookingSupportMeta;
  openDispute: AdminBookingSupportMeta["open_dispute"];
}) {
  const hasCritical = support.needs_attention.some((f) => f.severity === "critical");
  return (
    <div
      className={`${adminCard} px-5 py-4 text-center ${
        hasCritical
          ? "border-red-200/90 bg-red-50/50 ring-1 ring-red-200/50"
          : "border-amber-200/90 bg-amber-50/60 ring-1 ring-amber-200/50"
      }`}
    >
      <p
        className={`flex items-center justify-center gap-2 text-sm font-semibold ${
          hasCritical ? "text-red-900" : "text-amber-900"
        }`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Needs attention
      </p>
      <ul className="mx-auto mt-3 max-w-xl space-y-1.5 text-sm text-neutral-800">
        {support.needs_attention.map((flag) => (
          <li key={flag.code}>{flag.label}</li>
        ))}
      </ul>
      {support.next_action ? (
        <p className="mt-3 text-sm text-neutral-600">
          Try next: <span className="font-medium text-neutral-900">{support.next_action}</span>
        </p>
      ) : null}
      {openDispute ? (
        <Link
          href={`/admin/commerce?tab=disputes&dispute=${openDispute.id}`}
          className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
        >
          View open dispute
        </Link>
      ) : null}
    </div>
  );
}

export function AdminBookingDetailView({ bookingId }: Props) {
  const { booking, loading, error, reload } = useAdminBookingDetail(bookingId);
  const { canRunBookingSupportActions } = useAdminPermissions();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SupportAction | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [cancelParty, setCancelParty] = useState<"client" | "vendor">("client");
  const [cancelReason, setCancelReason] = useState("");

  const cancelFormParsed = parseForm(adminCancelBookingSchema, {
    reason: cancelReason,
    onBehalfOf: cancelParty,
  });
  const cancelFormValid = cancelFormParsed.ok;

  const runAction = async (action: SupportAction) => {
    if (action.id === "cancel") {
      if (!cancelFormValid) return;
    }
    setPendingAction(null);
    setFeedback(null);
    setActionBusy(action.id);
    try {
      await action.run();
      await reload();
      setFeedback({
        tone: "success",
        title: "Done",
        message: action.successMessage,
      });
      if (action.id === "cancel") {
        setCancelReason("");
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "Something went wrong",
        message: getApiErrorDetail(err) ?? "That didn't work. Try again.",
      });
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading booking…" rows={3} />;
  }

  if (error || !booking) {
    return <AdminErrorBanner message={error ?? "Not found."} />;
  }

  const lineItems = mapAdminLineItems(asArray(booking.line_items));
  const reviewVendor = asClientReview(booking.review_vendor);
  const pricing = asPricing(booking.pricing);
  const support = asSupport(booking.support);
  const eventName = String(booking.event_name ?? "Booking");
  const quoteTotalLabel = String(booking.total_label ?? booking.client_total_label ?? "—");
  const openDispute = support?.open_dispute;
  const holdActive = Boolean(support?.support_hold);

  const supportActions: SupportAction[] = [
    {
      id: "sync",
      title: "Check payment",
      tooltipHint: "e.g. client says they paid but booking still shows unpaid",
      confirmBody:
        "Use when the client says money left their account but Eventtz still shows unpaid. We'll find their payment and update the booking.",
      successMessage: "Payment checked — booking updated.",
      icon: CreditCard,
      run: () => adminSyncBookingPayment(bookingId),
    },
    {
      id: "reset",
      title: "Unblock checkout",
      tooltipHint: "e.g. client can't pay — checkout page is stuck or errors",
      confirmBody:
        "Use when the client can't complete payment — for example the pay button errors or spins forever. This lets them try paying again from scratch.",
      successMessage: "Checkout cleared. The client can try paying again.",
      icon: Unlock,
      run: () => adminResetBookingCheckout(bookingId),
    },
    {
      id: "payout",
      title: "Pay vendor",
      tooltipHint: "e.g. event went ahead but vendor hasn't received their money",
      confirmBody:
        "Use when the event happened and everyone is happy, but the vendor's money is still on hold. This sends them what they're owed.",
      successMessage: "Vendor paid.",
      icon: Wallet,
      run: () => adminReleaseBookingPayout(bookingId),
    },
    {
      id: "complete-cancel",
      title: "Finish cancellation",
      tooltipHint: "e.g. client got a refund but booking still looks confirmed",
      confirmBody:
        "Use when the client already received their money back but the booking still shows as active. This closes it out properly.",
      successMessage: "Booking marked as cancelled.",
      icon: RefreshCw,
      run: () => adminCompleteBookingCancellation(bookingId),
    },
    {
      id: "confirm-client",
      title: "Mark complete (client)",
      tooltipHint: "e.g. client emailed to say the event went well but didn't tap complete",
      confirmBody:
        "Use when the client has told you the event went well but forgot to mark it complete in the app. This records it on their behalf.",
      successMessage: "Recorded as complete for the client.",
      icon: CheckCircle2,
      run: () => adminConfirmBookingCompletion(bookingId, { party: "client" }),
    },
    {
      id: "confirm-vendor",
      title: "Mark complete (vendor)",
      tooltipHint: "e.g. vendor says they did the job but didn't tap complete",
      confirmBody:
        "Use when the vendor has confirmed they did the job but didn't mark it complete in the app. This records it on their behalf.",
      successMessage: "Recorded as complete for the vendor.",
      icon: CheckCircle2,
      run: () => adminConfirmBookingCompletion(bookingId, { party: "vendor" }),
    },
    {
      id: "hold",
      title: holdActive ? "Resume payout" : "Pause payout",
      tooltipHint: holdActive
        ? "e.g. you've finished looking into a complaint — OK to pay vendor"
        : "e.g. client complained — hold vendor's money while you investigate",
      confirmBody: holdActive
        ? "Use when you've finished investigating and it's OK for the vendor to be paid automatically again."
        : "Use when someone has raised a problem — for example the client says the vendor didn't show. The vendor won't be paid until you resume payout.",
      successMessage: holdActive ? "Automatic payout resumed." : "Automatic payout paused.",
      icon: holdActive ? Play : Pause,
      run: () => adminSetBookingSupportHold(bookingId, !holdActive),
    },
    {
      id: "maintenance",
      title: "Re-run checks",
      tooltipHint: "e.g. reminder emails didn't go out after the event",
      confirmBody:
        "Use when post-event reminders didn't send or you want the system to check if a payout is running late.",
      successMessage: "Checks completed.",
      icon: RefreshCw,
      run: () => adminRunBookingMaintenance(bookingId),
    },
    {
      id: "cancel",
      title: "Cancel booking",
      tooltipHint: "e.g. client or vendor asked support to cancel",
      confirmBody:
        "Use when the client or vendor has asked you to cancel — for example they can no longer make the date. If they've already paid, they'll get a refund.",
      successMessage: "Booking cancelled.",
      icon: Ban,
      destructive: true,
      run: () =>
        adminCancelBookingOnBehalf(bookingId, {
          party: cancelParty,
          reason: cancelReason.trim(),
        }),
    },
  ];

  const cancelAction = supportActions.find((a) => a.id === "cancel");
  const nonCancelActions = supportActions.filter((a) => a.id !== "cancel");
  const primaryActions = nonCancelActions.slice(0, VISIBLE_ACTION_COUNT);
  const moreActions = nonCancelActions.slice(VISIBLE_ACTION_COUNT);

  return (
    <div className="w-full space-y-5 text-left">
      <BackLink href="/admin/commerce?tab=bookings" label="Bookings" icon="chevron" tone="muted" />
      <nav className="text-[13px] text-neutral-500">
        <Link href="/admin/commerce?tab=bookings" className="hover:text-neutral-900">
          Bookings
        </Link>
        <span className="mx-1.5 text-neutral-300">/</span>
        <span className="text-neutral-900">{eventName}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{eventName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={String(booking.status ?? "")} />
          <PaymentStatusBadge status={String(booking.payment_status ?? "unpaid")} />
        </div>
        {(holdActive || support?.vendor_stripe_payouts_enabled === false) && (
          <p className="mt-2 text-xs text-neutral-500">
            {holdActive ? "Payout paused for this booking." : null}
            {holdActive && support?.vendor_stripe_payouts_enabled === false ? " · " : null}
            {support?.vendor_stripe_payouts_enabled === false
              ? "Vendor hasn't finished payout setup."
              : null}
          </p>
        )}
      </header>

      {support && support.needs_attention.length > 0 ? (
        <NeedsAttentionBanner support={support} openDispute={openDispute ?? null} />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <DetailSection title="Booking">
              <dl className="space-y-3">
                <Field label="Event date" value={String(booking.event_date ?? "—")} />
                <Field
                  label="Postcode"
                  value={booking.event_postcode != null ? String(booking.event_postcode) : "—"}
                />
                <Field label="Paid" value={formatTs(booking.paid_at)} />
                <Field label="Created" value={formatTs(booking.created_at)} />
              </dl>
            </DetailSection>

            <DetailSection title="People">
              <dl className="space-y-3">
                <Field label="Client" value={String(booking.client_email ?? "—")} />
                <Field label="Vendor" value={String(booking.vendor_display_name ?? "—")} />
                <Field label="Vendor email" value={String(booking.vendor_email ?? "—")} />
              </dl>
            </DetailSection>
          </div>

          <DetailSection title="Pricing">
            <BookingPricingBreakdown
              quoteTotalLabel={quoteTotalLabel}
              pricing={pricing}
              variant="client"
              lineItems={lineItems}
            />
          </DetailSection>

          <div className="grid gap-5 md:grid-cols-2">
            <DetailSection title="Payment">
              <dl className="space-y-3">
                <Field
                  label="Amount"
                  value={
                    booking.payment_amount_gbp != null
                      ? `£${Number(booking.payment_amount_gbp).toFixed(2)}`
                      : "—"
                  }
                />
                <Field
                  label="Payment intent"
                  value={<ExpandableId value={booking.stripe_payment_intent_id} label="payment intent" />}
                />
                <Field
                  label="Charge"
                  value={<ExpandableId value={booking.stripe_charge_id} label="charge" />}
                />
                <Field
                  label="Checkout session"
                  value={
                    <ExpandableId value={booking.stripe_checkout_session_id} label="checkout session" />
                  }
                />
              </dl>
            </DetailSection>

            <DetailSection title="Completion & payout">
              <dl className="space-y-3">
                <Field label="Client confirmed" value={formatTs(booking.client_completion_confirmed_at)} />
                <Field label="Vendor confirmed" value={formatTs(booking.vendor_completion_confirmed_at)} />
                <Field label="Payout sent" value={formatTs(booking.payout_released_at)} />
                <Field
                  label="Transfer"
                  value={<ExpandableId value={booking.stripe_transfer_id} label="transfer" />}
                />
              </dl>
            </DetailSection>
          </div>

          <DetailSection title="Review">
            <BookingReviewPanel
              title="Client review of vendor"
              review={reviewVendor}
              emptyLabel="No review yet."
            />
          </DetailSection>
        </div>

        <aside className="lg:sticky lg:top-6">
          <section className={`${adminCard} p-4`}>
            <h2 className="text-sm font-semibold text-neutral-900">Support actions</h2>
            {canRunBookingSupportActions ? (
              <>
                <p className="mt-0.5 text-xs text-neutral-500">Hover for when to use · logged in audit</p>

                <div className="mt-3 space-y-0.5">
                  {primaryActions.map((action) => (
                    <CompactActionRow
                      key={action.id}
                      action={action}
                      busy={actionBusy === action.id}
                      onSelect={setPendingAction}
                    />
                  ))}
                </div>

                {moreActions.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActionsExpanded((v) => !v)}
                      className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[12px] font-medium text-primary hover:underline"
                    >
                      {actionsExpanded ? "Show fewer" : `More actions (${moreActions.length})`}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${actionsExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {actionsExpanded ? (
                      <div className="space-y-0.5 border-t border-neutral-100 pt-2">
                        {moreActions.map((action) => (
                          <CompactActionRow
                            key={action.id}
                            action={action}
                            busy={actionBusy === action.id}
                            onSelect={setPendingAction}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {cancelAction ? (
                  <div className="mt-3 border-t border-neutral-100 pt-2">
                    <CompactActionRow
                      action={cancelAction}
                      busy={actionBusy === "cancel"}
                      onSelect={setPendingAction}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                Payment and refund actions are limited to super admins. You can review
                this booking and escalate if needed.
              </p>
            )}
          </section>
        </aside>
      </div>

      <Modal
        isOpen={Boolean(pendingAction)}
        onClose={() => {
          if (!actionBusy) setPendingAction(null);
        }}
        title={pendingAction ? pendingAction.title : "Confirm"}
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setPendingAction(null)}
              disabled={Boolean(actionBusy)}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction?.destructive ? "destructive" : "primary"}
              loading={Boolean(actionBusy)}
              disabled={pendingAction?.id === "cancel" && !cancelFormValid}
              onClick={() => {
                if (pendingAction) void runAction(pendingAction);
              }}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-left">
          {pendingAction ? (
            <p className="text-sm leading-relaxed text-neutral-700">{pendingAction.confirmBody}</p>
          ) : null}

          {pendingAction?.id === "cancel" ? (
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="text-neutral-600">On behalf of</span>
                <select
                  value={cancelParty}
                  onChange={(e) => setCancelParty(e.target.value as "client" | "vendor")}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-neutral-600">Reason (required, at least 3 characters)</span>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Why support is cancelling"
                />
              </label>
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">Recorded in the admin audit log.</p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(feedback)}
        onClose={() => setFeedback(null)}
        title={feedback?.title ?? "Result"}
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setFeedback(null)}>Done</Button>
          </div>
        }
      >
        <p
          className={`text-sm ${
            feedback?.tone === "error" ? "text-red-700" : "text-neutral-800"
          }`}
        >
          {feedback?.message}
        </p>
      </Modal>
    </div>
  );
}
