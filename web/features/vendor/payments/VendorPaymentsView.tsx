"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import { useToast } from "@/components/ui/Toast";
import { VendorPaymentHistory } from "@/features/vendor/payments/VendorPaymentHistory";
import { VendorPayoutAccountPanel } from "@/features/vendor/payments/VendorPayoutAccountPanel";
import {
  isVendorPayoutsReady,
  useVendorPayoutsReady,
} from "@/features/vendor/payments/useVendorPayoutsReady";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

const TABS = [
  { id: "account", label: "Payout account" },
  { id: "history", label: "Payout history" },
] as const;

type VendorPaymentsTabId = (typeof TABS)[number]["id"];

function resolvePaymentsTab(value: string | null): VendorPaymentsTabId {
  if (value && TABS.some((tab) => tab.id === value)) {
    return value as VendorPaymentsTabId;
  }
  return "account";
}

/**
 * Standalone payout status + Stripe Connect entry point, reachable from the
 * portal nav at any time (and from Accept booking when payouts are not ready).
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

  const {
    status,
    loading,
    connecting,
    error,
    refresh,
    connectPayouts,
  } = useVendorPayoutsReady(true);

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
    void connectPayouts("/vendor/payments");
  };

  const activeLabel = TABS.find((item) => item.id === tab)?.label;

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <SettingsTabs tabs={TABS} activeId={tab} basePath="/vendor/payments" />

      <div role="tabpanel" aria-label={activeLabel}>
        {tab === "account" ? (
          <VendorPayoutAccountPanel
            status={status}
            loading={loading}
            connecting={connecting}
            error={error}
            onConnect={startStripeConnectOnboarding}
          />
        ) : (
          <VendorPaymentHistory />
        )}
      </div>
    </div>
  );
}
