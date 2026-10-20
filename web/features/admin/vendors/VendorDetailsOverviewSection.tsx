"use client";

import { useMemo } from "react";
import type { AdminListingMediaSavePayload, AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import {
  AdminVendorSubmissionReview,
  type AdminVendorSubmissionReviewPanel,
} from "./AdminVendorSubmissionReview";
import { adminVendorToOnboardingData } from "./adminVendorOnboardingData";
import { buildAdminVendorSubmissionReviewModel } from "./adminVendorSubmissionReviewModel";
import type { AdminVendorUnsubmitHandler } from "./vendorUnsubmitTypes";

type Props = {
  panel: AdminVendorSubmissionReviewPanel;
  vendor: AdminVendorRow;
  busyId?: string | null;
  onUnsubmit?: AdminVendorUnsubmitHandler;
  onReportError?: (message: string) => void;
  onSaveListingMedia?: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
  onSetApproval?: (userId: string, status: VendorApprovalStatus) => Promise<boolean>;
  onSetListingOverride?: (
    userId: string,
    override: VendorListingOverride,
    reason?: string,
  ) => Promise<boolean>;
  onRestoreStripe?: (userId: string) => Promise<boolean>;
};

export function VendorDetailsOverviewSection({
  panel,
  vendor,
  busyId,
  onUnsubmit,
  onReportError,
  onSaveListingMedia,
  onSetApproval,
  onSetListingOverride,
  onRestoreStripe,
}: Props) {
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
      <div className="ez-banner ez-banner--warning">
        <div className="ez-banner__body">
          <p className="text-sm text-amber-900">
        Could not load this vendor&apos;s submission. Try closing and reopening the
        profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminVendorSubmissionReview
      model={model}
      panel={panel}
      vendor={vendor}
      busyId={busyId}
      onUnsubmit={onUnsubmit}
      onReportError={onReportError}
      onSaveListingMedia={onSaveListingMedia}
      onSetApproval={onSetApproval}
      onSetListingOverride={onSetListingOverride}
      onRestoreStripe={onRestoreStripe}
    />
  );
}
