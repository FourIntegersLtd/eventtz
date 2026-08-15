"use client";

import { useMemo } from "react";
import type { AdminListingMediaSavePayload, AdminVendorRow } from "@/lib/adminVendorsApi";
import { AdminVendorSubmissionReview } from "./AdminVendorSubmissionReview";
import { adminVendorToOnboardingData } from "./adminVendorOnboardingData";
import { buildAdminVendorSubmissionReviewModel } from "./adminVendorSubmissionReviewModel";
import type { AdminVendorUnsubmitHandler } from "./vendorUnsubmitTypes";

type Props = {
  vendor: AdminVendorRow;
  busyId?: string | null;
  onUnsubmit?: AdminVendorUnsubmitHandler;
  onReportError?: (message: string) => void;
  onSaveListingMedia?: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
};

export function VendorDetailsOverviewSection({ vendor, busyId, onUnsubmit, onReportError, onSaveListingMedia }: Props) {
  const model = useMemo(() => {
    try {
      const data = adminVendorToOnboardingData(vendor);
      return buildAdminVendorSubmissionReviewModel(data);
    } catch {
      return null;
    }
  }, [vendor]);

  if (!model) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Could not load this vendor&apos;s submission. Try closing and reopening the
        profile.
      </p>
    );
  }

  return (
    <AdminVendorSubmissionReview
      model={model}
      vendor={vendor}
      busyId={busyId}
      onUnsubmit={onUnsubmit}
      onReportError={onReportError}
      onSaveListingMedia={onSaveListingMedia}
    />
  );
}
