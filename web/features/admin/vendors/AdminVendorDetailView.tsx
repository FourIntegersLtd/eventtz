"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { VendorApprovalStatusBadge } from "@/components/badges/VendorApprovalStatusBadge";
import { VendorPayoutStatusBadge } from "@/components/badges/VendorPayoutStatusBadge";
import { VendorProfileStatusBadge } from "@/components/badges/VendorProfileStatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { fetchAdminVendorInsights, type AdminVendorInsights } from "@/lib/adminVendorsApi";
import { VendorDetailsInsightsSection } from "./VendorDetailsInsightsSection";
import { VendorDetailsOverviewSection } from "./VendorDetailsOverviewSection";
import { useAdminVendorDetail } from "./useAdminVendorDetail";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import {
  buildVendorProfileData,
  parseVendorDetailsTabId,
  VENDOR_DETAILS_TAB_CONFIG,
} from "./vendorDetailsShared";

const VENDORS_LIST_HREF = "/admin/directory?tab=vendors";

/** One vendor's admin page (opened from the directory): profile, marketplace stats and staff actions. */
export function AdminVendorDetailView({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => parseVendorDetailsTabId(searchParams.get("tab")),
    [searchParams],
  );
  const {
    vendor,
    loading,
    notFound,
    error,
    busyId,
    setApproval,
    setListingOverride,
    setListingMedia,
    restoreStripeConnect,
    unsubmitVendor,
    reportError,
  } = useAdminVendorDetail(userId);
  const [insights, setInsights] = useState<AdminVendorInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminVendorInsights(userId)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch(() => {
        if (!cancelled) {
          setInsights(null);
          setInsightsError("Could not load marketplace stats.");
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const backLink = (
    <Link href={VENDORS_LIST_HREF} className="ez-back">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      All vendors
    </Link>
  );

  if (loading) return <AdminLoadingState label="Loading vendor…" />;
  if (notFound || !vendor) {
    return (
      <div className="ez-stack">
        {backLink}
        {error ? (
          <AdminErrorBanner message={error} />
        ) : (
          <EmptyState title="Vendor not found" lottie="searchNoResults" />
        )}
      </div>
    );
  }

  const profile = buildVendorProfileData(vendor);
  const businessName = profile.businessName;

  return (
    <div className="ez-stack ez-stack--lg text-sm">
      {backLink}
      {error ? <AdminErrorBanner message={error} /> : null}

      <PageHeader
        className="mb-0"
        title={businessName}
        description={vendor.email || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <VendorApprovalStatusBadge status={vendor.approval_status} />
            <VendorProfileStatusBadge status={vendor.onboarding_status} />
            <VendorPayoutStatusBadge verified={vendor.payouts_verified} />
            <Link
              href={insights?.explore_path ?? `/client/browse/${vendor.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ez-link inline-flex items-center gap-1.5 text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Public profile
            </Link>
          </div>
        }
      />

      <AdminSectionTabs
        tabs={VENDOR_DETAILS_TAB_CONFIG}
        activeId={tab}
        basePath={`/admin/directory/vendors/${userId}`}
      />

      {tab === "profile" ? (
        <VendorDetailsOverviewSection
          panel="submission"
          vendor={vendor}
          busyId={busyId}
          onUnsubmit={unsubmitVendor}
          onReportError={reportError}
          onSaveListingMedia={(payload) => setListingMedia(vendor.user_id, payload)}
          onSetApproval={setApproval}
          onSetListingOverride={setListingOverride}
          onRestoreStripe={restoreStripeConnect}
        />
      ) : null}

      {tab === "insights" ? (
        <VendorDetailsInsightsSection
          vendor={vendor}
          businessName={businessName}
          insights={insights}
          insightsLoading={insightsLoading}
          insightsError={insightsError}
        />
      ) : null}

      {tab === "actions" ? (
        <VendorDetailsOverviewSection
          panel="staff"
          vendor={vendor}
          busyId={busyId}
          onUnsubmit={unsubmitVendor}
          onReportError={reportError}
          onSaveListingMedia={(payload) => setListingMedia(vendor.user_id, payload)}
          onSetApproval={setApproval}
          onSetListingOverride={setListingOverride}
          onRestoreStripe={restoreStripeConnect}
        />
      ) : null}
    </div>
  );
}
