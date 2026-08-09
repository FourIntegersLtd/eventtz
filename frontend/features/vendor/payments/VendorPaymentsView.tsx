"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import { VendorPaymentHistory } from "@/features/vendor/payments/VendorPaymentHistory";
import { VendorPayoutAccountPanel } from "@/features/vendor/payments/VendorPayoutAccountPanel";
import {
  fetchStripePaymentsStatus,
  getApiErrorDetail,
  postConnectStripeAccount,
  type VendorPaymentsStatus,
} from "@/lib/vendorPaymentsApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

const TABS = [
  { id: "account", label: "Payout account" },
  { id: "history", label: "Payment history" },
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
  const tab = useMemo(
    (): VendorPaymentsTabId => resolvePaymentsTab(searchParams.get("tab")),
    [searchParams],
  );

  const [status, setStatus] = useState<VendorPaymentsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStripePaymentsStatus();
      setStatus(res);
    } catch {
      setError("Could not load your payout status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "return" && stripeParam !== "refresh") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stripe");
    if (!params.get("tab")) {
      params.set("tab", "account");
    }
    const next = params.toString();
    router.replace(next ? `/vendor/payments?${next}` : "/vendor/payments?tab=account");
    void (async () => {
      await refresh();
      if (stripeParam === "return") {
        try {
          const res = await fetchStripePaymentsStatus();
          if (res.charges_enabled && res.payouts_enabled) {
            track(MixpanelEvents.vendor_payouts_ready, { source: "payments" });
          }
        } catch {
          /* refresh already set error */
        }
      }
    })();
  }, [searchParams, router, refresh]);

  const onConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      track(MixpanelEvents.vendor_payout_setup_started, {
        source: "payments",
        return_path: "/vendor/payments",
      });
      const { onboarding_url } = await postConnectStripeAccount("/vendor/payments");
      window.location.href = onboarding_url;
    } catch (err) {
      setError(getApiErrorDetail(err) ?? "We couldn't start payout setup. Please try again.");
      setConnecting(false);
    }
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
            onConnect={() => void onConnect()}
          />
        ) : (
          <VendorPaymentHistory />
        )}
      </div>
    </div>
  );
}
