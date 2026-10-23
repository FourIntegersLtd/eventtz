"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchVendorAnalytics,
  type VendorAnalytics,
} from "@/lib/vendorAnalyticsApi";
import { fetchVendorProfile, type VendorProfileResponse } from "@/lib/vendorProfileApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import type { AdminPeriodDays } from "@/lib/commercePeriod";
import { VendorAnalyticsEzView } from "@/features/vendor/analytics/VendorAnalyticsEzView";

export function VendorAnalyticsView() {
  const [data, setData] = useState<VendorAnalytics | null>(null);
  const [profile, setProfile] = useState<VendorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AdminPeriodDays>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analytics, vendorProfile] = await Promise.all([
        fetchVendorAnalytics(period),
        fetchVendorProfile().catch(() => null),
      ]);
      setData(analytics);
      setProfile(vendorProfile);
    } catch (loadError) {
      setError(getApiErrorDetail(loadError) ?? "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <LoadingState label="Loading your analytics…" variant="centered" />;
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <AdminErrorBanner message={error} />
        <Button variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const businessName =
    profile?.profile_form_data?.businessName ??
    profile?.profile_form_data?.business_name ??
    null;

  return (
    <VendorAnalyticsEzView
      data={data}
      period={period}
      onPeriodChange={setPeriod}
      businessName={typeof businessName === "string" ? businessName : null}
    />
  );
}
