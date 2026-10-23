"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Clock, TrendingUp, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { VendorPayoutAccountPanel } from "@/features/vendor/payments/VendorPayoutAccountPanel";
import {
  isVendorPayoutsReady,
  useVendorPayoutsReady,
} from "@/features/vendor/payments/useVendorPayoutsReady";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { VendorEzPageHead } from "@/components/ui/VendorEzPageHead";
import { fetchVendorDashboard } from "@/lib/portalDashboardApi";
import { formatEventDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchVendorPayoutHistoryPage,
  VENDOR_PAYOUTS_PAGE_SIZE,
  type VendorPayoutHistory,
  type VendorPayoutRow,
} from "@/lib/vendorPaymentsApi";

type VendorPaymentsTabId = "payouts" | "payments" | "account";

function resolvePaymentsTab(value: string | null): VendorPaymentsTabId {
  if (value === "account") return "account";
  if (value === "payments") return "payments";
  if (value === "history" || value === "payouts") return "payouts";
  return "payouts";
}

function payoutBadge(status: string): { label: string; className: string } {
  if (status === "paid_out") return { label: "Payout sent", className: "ez-badge ez-badge--success" };
  if (status === "awaiting_payout") return { label: "Payout held", className: "ez-badge ez-badge--warning" };
  if (status === "refunded") return { label: "Refunded", className: "ez-badge ez-badge--info" };
  return { label: status, className: "ez-badge ez-badge--neutral" };
}

/**
 * Payments and payouts (design V25). Stripe Connect is unchanged; this only
 * lays out the existing status and payout history.
 */
export function VendorPaymentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const tab = useMemo(
    (): VendorPaymentsTabId => resolvePaymentsTab(searchParams.get("tab")),
    [searchParams],
  );
  const stripeReturnHandled = useRef(false);
  const [history, setHistory] = useState<VendorPayoutHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [payoutOffset, setPayoutOffset] = useState(0);
  // Whole-account count from the server; the payout rows on screen are only one page.
  const [heldBookingCount, setHeldBookingCount] = useState<number | null>(null);

  const {
    status,
    loading,
    connecting,
    error,
    refresh,
    connectPayouts,
  } = useVendorPayoutsReady(true);

  useEffect(() => {
    void fetchVendorPayoutHistoryPage(payoutOffset, VENDOR_PAYOUTS_PAGE_SIZE)
      .then(setHistory)
      .catch(() => setHistoryError("Could not load payout history."));
  }, [payoutOffset]);

  useEffect(() => {
    void fetchVendorDashboard()
      .then((dashboard) => setHeldBookingCount(dashboard.held_payouts_count))
      .catch(() => setHeldBookingCount(null));
  }, []);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    if (stripeReturnHandled.current) return;
    stripeReturnHandled.current = true;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("stripe");
    if (!params.get("tab")) {
      params.set("tab", "account");
    }
    const next = params.toString();
    router.replace(next ? `/vendor/payments?${next}` : "/vendor/payments?tab=account");
    void (async () => {
      const res = await refresh();
      if (stripeParam === "return" && isVendorPayoutsReady(res)) {
        track(MixpanelEvents.vendor_payouts_ready, { source: "payments" });
        showToast({ title: "Payout account connected", tone: "success" });
      }
    })();
  }, [searchParams, router, refresh, showToast]);

  const startStripeConnectOnboarding = () => {
    void connectPayouts("/vendor/payments?tab=account");
  };

  const rows = history?.payouts ?? [];
  const payoutTotal = history?.total ?? rows.length;
  const held = history?.total_awaiting_gbp ?? 0;
  const nextHeld = rows.find((row) => row.status === "awaiting_payout");
  const payoutsReady = isVendorPayoutsReady(status);

  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Payments"
        title="Payments and payouts"
        description="Track every payment in and every payout out."
      />

      {held > 0 ? (
        <div className="ez-banner ez-banner--warning">
          <Wallet size={20} strokeWidth={1.75} aria-hidden />
          <div className="ez-banner__body">
            <div className="ez-banner__title">{history?.total_awaiting_label ?? formatMoney(held)} is held</div>
            <p className="ez-small" style={{ color: "inherit" }}>
              Held payouts are released when the event is confirmed complete.
              {payoutsReady ? "" : " Finish payout setup so they can be sent."}
            </p>
          </div>
          {payoutsReady ? null : (
            <div className="ez-banner__actions">
              <button className="ez-btn ez-btn--secondary" type="button" disabled={connecting} onClick={startStripeConnectOnboarding}>
                {connecting ? "Opening Stripe…" : "Open payout account"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="ez-grid-4">
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Clock size={16} strokeWidth={1.75} aria-hidden />
            Held
          </span>
          <span className="ez-kpi__value">{history?.total_awaiting_label ?? "-"}</span>
          <span className="ez-kpi__delta">
            {heldBookingCount === null ? "-" : `${heldBookingCount} bookings`}
          </span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Wallet size={16} strokeWidth={1.75} aria-hidden />
            Paid out, last 30 days
          </span>
          <span className="ez-kpi__value">{history?.paid_out_last_30_days_label ?? "-"}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Calendar size={16} strokeWidth={1.75} aria-hidden />
            Next release
          </span>
          <span className="ez-kpi__value">{nextHeld?.event_date ? formatEventDate(nextHeld.event_date) : "-"}</span>
          <span className="ez-kpi__delta">{nextHeld?.client_display_name ?? nextHeld?.event_name ?? ""}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
            Paid out
          </span>
          <span className="ez-kpi__value">{history?.total_paid_out_label ?? "-"}</span>
        </div>
      </div>

      <div className="ez-tabs" role="tablist">
        <Link className={`ez-tab${tab === "payouts" ? " ez-tab--active" : ""}`} href="/vendor/payments?tab=payouts">
          Payouts<span className="ez-tab__count">{payoutTotal}</span>
        </Link>
        <Link className={`ez-tab${tab === "payments" ? " ez-tab--active" : ""}`} href="/vendor/payments?tab=payments">
          Payments received<span className="ez-tab__count">{payoutTotal}</span>
        </Link>
        <Link className={`ez-tab${tab === "account" ? " ez-tab--active" : ""}`} href="/vendor/payments?tab=account">
          Payout account
        </Link>
      </div>

      {historyError ? <p className="ez-small">{historyError}</p> : null}

      {tab === "account" ? (
        <VendorPayoutAccountPanel
          status={status}
          loading={loading}
          connecting={connecting}
          error={error}
          onConnect={startStripeConnectOnboarding}
        />
      ) : history ? (
        // One history list exists. Payouts and Payments received are the same rows.
        <>
          <PayoutTable rows={rows} />
          <TablePagination
            offset={payoutOffset}
            limit={VENDOR_PAYOUTS_PAGE_SIZE}
            total={payoutTotal}
            onPrevious={() =>
              setPayoutOffset((current) => Math.max(0, current - VENDOR_PAYOUTS_PAGE_SIZE))
            }
            onNext={() => setPayoutOffset((current) => current + VENDOR_PAYOUTS_PAGE_SIZE)}
          />
        </>
      ) : (
        <LoadingState label="Loading payouts…" variant="inline" />
      )}
    </div>
  );
}

function PayoutTable({ rows }: { rows: VendorPayoutRow[] }) {
  if (rows.length === 0) {
    return <EmptyState className="border-0" variant="payments" title="No payouts yet" />;
  }
  return (
    <div className="ez-table-wrap">
      <table className="ez-table">
        <thead>
          <tr>
            <th>Booking</th>
            <th>Client</th>
            <th>Event date</th>
            <th className="ez-td-num">Amount</th>
            <th className="ez-td-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = payoutBadge(row.status);
            return (
              <tr key={`${row.booking_id}-${row.kind ?? "event"}`}>
                <td className="ez-td-strong">
                  <Link href={`/vendor/bookings/${row.booking_id}`}>{row.event_name}</Link>
                </td>
                <td>{row.client_display_name ?? "-"}</td>
                <td>{row.event_date ? formatEventDate(row.event_date) : "-"}</td>
                <td className="ez-td-num">{row.amount_label}</td>
                <td className="ez-td-status">
                  <span className={badge.className}>{badge.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
