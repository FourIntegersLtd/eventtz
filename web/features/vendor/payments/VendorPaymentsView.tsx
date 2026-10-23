"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Clock, TrendingUp, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { PaymentsListSection } from "@/features/receipts/PaymentsListSection";
import { useServerList } from "@/lib/useServerList";
import type { Tone } from "@/lib/tone";
import { VendorPayoutAccountPanel } from "@/features/vendor/payments/VendorPayoutAccountPanel";
import {
  isVendorPayoutsReady,
  useVendorPayoutsReady,
} from "@/features/vendor/payments/useVendorPayoutsReady";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchVendorDashboard } from "@/lib/portalDashboardApi";
import { formatEventDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
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

function payoutBadge(status: string): { label: string; tone: Tone } {
  if (status === "paid_out") return { label: "Payout sent", tone: "success" };
  if (status === "awaiting_payout") return { label: "Payout held", tone: "warning" };
  if (status === "refunded") return { label: "Refunded", tone: "info" };
  return { label: status, tone: "neutral" };
}

/** Columns of the payout table; one row per ledger entry. */
const PAYOUT_COLUMNS: DataTableColumn<VendorPayoutRow>[] = [
  {
    key: "booking",
    header: "Booking",
    kind: "strong",
    cell: (row) => <Link href={`/vendor/bookings/${row.booking_id}`}>{row.event_name}</Link>,
  },
  { key: "client", header: "Client", cell: (row) => row.client_display_name ?? "-" },
  { key: "event_date", header: "Event date", cell: (row) => (row.event_date ? formatEventDate(row.event_date) : "-") },
  { key: "amount", header: "Amount", kind: "num", cell: (row) => row.amount_label },
  {
    key: "status",
    header: "Status",
    kind: "status",
    cell: (row) => {
      const badge = payoutBadge(row.status);
      return <Badge tone={badge.tone}>{badge.label}</Badge>;
    },
  },
];

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
  // The summary figures (totals, next release) ride on every page of the ledger; keep the newest.
  const [history, setHistory] = useState<VendorPayoutHistory | null>(null);
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

  const payoutList = useServerList<VendorPayoutRow>({
    pageSize: VENDOR_PAYOUTS_PAGE_SIZE,
    errorMessage: "Could not load payout history.",
    fetchPage: async ({ offset, limit }) => {
      const page = await fetchVendorPayoutHistoryPage(offset, limit);
      setHistory(page);
      return { items: page.payouts, total: page.total };
    },
    filters: {},
  });

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

  const payoutTotal = payoutList.total;
  const held = history?.total_awaiting_gbp ?? 0;
  const payoutsReady = isVendorPayoutsReady(status);

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Payments"
        title="Payments and payouts"
        description="Track every payment in and every payout out."
      />

      {held > 0 ? (
        <Banner
          tone="warning"
          icon={<Wallet size={20} strokeWidth={1.75} aria-hidden />}
          title={`${history?.total_awaiting_label ?? formatMoney(held)} is held`}
          action={
            payoutsReady ? null : (
              <Button variant="secondary" disabled={connecting} onClick={startStripeConnectOnboarding}>
                {connecting ? "Opening Stripe…" : "Open payout account"}
              </Button>
            )
          }
        >
          <p className="ez-small">
            Held payouts are released when the event is confirmed complete.
            {payoutsReady ? "" : " Finish payout setup so they can be sent."}
          </p>
        </Banner>
      ) : null}

      <div className="ez-grid-4">
        <StatTile
          icon={Clock}
          label="Held"
          value={history?.total_awaiting_label ?? "-"}
          delta={heldBookingCount === null ? "-" : `${heldBookingCount} bookings`}
          deltaTone="success"
        />
        <StatTile icon={Wallet} label="Paid out, last 30 days" value={history?.paid_out_last_30_days_label ?? "-"} />
        <StatTile
          icon={Calendar}
          label="Next release"
          value={history?.next_release_event_date ? formatEventDate(history.next_release_event_date) : "-"}
          delta={history?.next_release_label ?? ""}
          deltaTone="success"
        />
        <StatTile icon={TrendingUp} label="Paid out" value={history?.total_paid_out_label ?? "-"} />
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

      {tab === "account" ? (
        <VendorPayoutAccountPanel
          status={status}
          loading={loading}
          connecting={connecting}
          error={error}
          onConnect={startStripeConnectOnboarding}
        />
      ) : (
        // One history list exists. Payouts and Payments received are the same rows.
        <PaymentsListSection
          list={{ ...payoutList, itemCount: payoutList.items.length }}
          loadingLabel="Loading payouts…"
          isEmpty={payoutList.total === 0}
          empty={<EmptyState className="border-0" variant="payments" title="No payouts yet" />}
        >
          <DataTable
            aria-label="Payouts"
            columns={PAYOUT_COLUMNS}
            rows={payoutList.items}
            getRowKey={(row) => `${row.booking_id}-${row.kind ?? "event"}`}
          />
        </PaymentsListSection>
      )}
    </div>
  );
}
