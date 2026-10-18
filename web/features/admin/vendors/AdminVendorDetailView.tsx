"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { VendorApprovalStatusBadge } from "@/components/badges/VendorApprovalStatusBadge";
import { VendorPayoutStatusBadge } from "@/components/badges/VendorPayoutStatusBadge";
import { VendorProfileStatusBadge } from "@/components/badges/VendorProfileStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { fetchAdminVendorInsights, type AdminVendorInsights } from "@/lib/adminVendorsApi";
import { VendorConsequencesSection } from "./VendorConsequencesSection";
import { VendorInsuranceSection } from "./VendorInsuranceSection";
import { VendorDetailsApprovalSection } from "./VendorDetailsApprovalSection";
import { VendorDetailsInsightsSection } from "./VendorDetailsInsightsSection";
import { VendorDetailsOverviewSection } from "./VendorDetailsOverviewSection";
import { useAdminVendorDetail } from "./useAdminVendorDetail";
import {
  buildVendorProfileData,
  TabButton,
  VENDOR_DETAILS_TAB_CONFIG,
  type VendorDetailsTabId,
} from "./vendorDetailsShared";

const VENDORS_LIST_HREF = "/admin/directory?tab=vendors";

/** One vendor's admin page (opened from the directory): profile, marketplace stats and staff actions. */
export function AdminVendorDetailView({ userId }: { userId: string }) {
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
  const [tab, setTab] = useState<VendorDetailsTabId>("profile");
  const [insights, setInsights] = useState<AdminVendorInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    // The page is keyed by `userId` in its URL, so the initial loading state is the only one needed.
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
    <Link
      href={VENDORS_LIST_HREF}
      className="inline-flex items-center gap-0.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      All vendors
    </Link>
  );

  if (loading) return <AdminLoadingState label="Loading vendor…" />;
  if (notFound || !vendor) {
    return (
      <div className="space-y-4">
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
    <div className="space-y-6 text-sm">
      {backLink}
      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-neutral-900">{businessName}</h1>
          {vendor.email ? <p className="mt-0.5 truncate text-neutral-500">{vendor.email}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <VendorApprovalStatusBadge status={vendor.approval_status} />
          <VendorProfileStatusBadge status={vendor.onboarding_status} />
          <VendorPayoutStatusBadge verified={vendor.payouts_verified} />
          <Link
            href={insights?.explore_path ?? `/client/browse/${vendor.user_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Public profile
          </Link>
        </div>
      </div>

      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]"
        role="tablist"
      >
        {VENDOR_DETAILS_TAB_CONFIG.map(({ id, label, icon }) => (
          <TabButton key={id} active={tab === id} icon={icon} onClick={() => setTab(id)}>
            {label}
          </TabButton>
        ))}
      </div>

      {tab === "profile" ? (
        <VendorDetailsOverviewSection
          vendor={vendor}
          busyId={busyId}
          onUnsubmit={unsubmitVendor}
          onReportError={reportError}
          onSaveListingMedia={(payload) => setListingMedia(vendor.user_id, payload)}
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
        <>
          <VendorDetailsApprovalSection
            vendor={vendor}
            busyId={busyId}
            onSetApproval={setApproval}
            onSetListingOverride={setListingOverride}
            onRestoreStripe={restoreStripeConnect}
          />
          <VendorInsuranceSection key={vendor.user_id} vendor={vendor} />
          <VendorConsequencesSection vendor={vendor} />
        </>
      ) : null}
    </div>
  );
}
