"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Spinner } from "@/foundation/ui";
import { PlatformError } from "@/foundation/platform-client";
import {
  fetchVendorPaymentsStatus,
  fetchVendorPayoutHistory,
  startVendorPayoutsConnect,
  type VendorPaymentsStatus,
  type VendorPayoutHistory,
} from "@/domains/vendor-payments/api";
import {
  payoutConnectButtonLabel,
  payoutRowStatusLabel,
  payoutSetupHeadline,
  payoutSetupStage,
} from "@/domains/vendor-payments/format";

type PaymentsTab = "account" | "history";

const TABS: readonly { id: PaymentsTab; label: string }[] = [
  { id: "account", label: "Payout account" },
  { id: "history", label: "Payout history" },
];

/**
 * The vendor payments page: Stripe Connect setup status plus the payout
 * ledger. Ported from the baseline's `VendorPaymentsView`, simplified to one
 * client component (the baseline splits setup/history into several feature
 * files this workstream did not need to mirror one-for-one).
 */
export function VendorPaymentsView() {
  const [tab, setTab] = useState<PaymentsTab>("account");
  const [status, setStatus] = useState<VendorPaymentsStatus | null>(null);
  const [history, setHistory] = useState<VendorPayoutHistory | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await fetchVendorPaymentsStatus());
      setError(null);
    } catch (cause) {
      setError(cause instanceof PlatformError ? cause.detail : "Could not load your payout status.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // The loader is invoked through a `??=` on a ref rather than a plain call
  // statement, matching `foundation/session/SessionProvider.tsx`'s
  // `refresh`/`load` split — several callers can await the same in-flight
  // request instead of each firing their own.
  const statusInFlight = useRef<Promise<void> | null>(null);
  const refreshStatus = useCallback(() => {
    statusInFlight.current ??= loadStatus().finally(() => {
      statusInFlight.current = null;
    });
    return statusInFlight.current;
  }, [loadStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await fetchVendorPayoutHistory());
    } catch {
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const historyInFlight = useRef<Promise<void> | null>(null);
  const refreshHistory = useCallback(() => {
    historyInFlight.current ??= loadHistory().finally(() => {
      historyInFlight.current = null;
    });
    return historyInFlight.current;
  }, [loadHistory]);

  useEffect(() => {
    if (tab !== "history" || history) return;
    void refreshHistory();
  }, [tab, history, refreshHistory]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const response = await startVendorPayoutsConnect();
      window.location.href = response.onboarding_url;
    } catch (cause) {
      setError(cause instanceof PlatformError ? cause.detail : "Could not start Stripe onboarding.");
      setConnecting(false);
    }
  }

  const stage = payoutSetupStage(status);

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex gap-2 border-b border-primary-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={clsx(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === item.id ? "border-primary text-primary" : "border-transparent text-neutral-500",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "account" ? (
        loadingStatus ? (
          <Spinner label="Loading payout status" />
        ) : (
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">{payoutSetupHeadline(stage)}</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm text-neutral-700 sm:grid-cols-3">
              <div>
                <dt className="text-neutral-500">Stripe account</dt>
                <dd>{status?.stripe_account_id ? "Connected" : "Not connected"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Charges</dt>
                <dd>{status?.charges_enabled ? "Enabled" : "Not enabled"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Payouts</dt>
                <dd>{status?.payouts_enabled ? "Enabled" : "Not enabled"}</dd>
              </div>
            </dl>
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
            <Button onClick={handleConnect} loading={connecting}>
              {payoutConnectButtonLabel(stage, connecting)}
            </Button>
          </Card>
        )
      ) : loadingHistory ? (
        <Spinner label="Loading payout history" />
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-neutral-500">Paid out</p>
              <p className="text-lg font-semibold text-neutral-900">{history?.total_paid_out_label ?? "£0"}</p>
            </div>
            <div>
              <p className="text-neutral-500">Awaiting payout</p>
              <p className="text-lg font-semibold text-neutral-900">{history?.total_awaiting_label ?? "£0"}</p>
            </div>
          </div>
          {history?.payouts && history.payouts.length > 0 ? (
            <ul className="divide-y divide-primary-border">
              {history.payouts.map((payout) => (
                <li key={payout.booking_id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{payout.event_name}</p>
                    <p className="text-neutral-500">{payout.client_display_name ?? "Client"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-neutral-900">{payout.amount_label}</p>
                    <p className="text-neutral-500">{payoutRowStatusLabel(payout.status)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No payouts yet.</p>
          )}
        </Card>
      )}
    </div>
  );
}
