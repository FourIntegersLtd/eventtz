"use client";

import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  AdminListingMediaEditor,
} from "@/features/admin/vendors/AdminListingMediaEditor";
import { SubmittedMediaViewer } from "@/features/admin/vendors/SubmittedMediaViewer";
import type { SubmittedMediaBundle } from "@/lib/submittedMediaUtils";
import { Card, CardBody } from "@/components/ui/Card";

type Props = {
  initials: string;
  businessName: string;
  fullName: string;
  submittedMedia: SubmittedMediaBundle;
  vendorUserId?: string;
  profileFormData?: Record<string, unknown>;
  listingMediaDisabled?: boolean;
  onSaveListingMedia?: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
  /** Inside a parent section card — no nested card or name footer. */
  embedded?: boolean;
};

export function AdminVendorSubmissionMediaRail({
  initials,
  businessName,
  fullName,
  submittedMedia,
  vendorUserId,
  profileFormData,
  listingMediaDisabled = false,
  onSaveListingMedia,
  embedded = false,
}: Props) {
  const editableListingMedia =
    vendorUserId && profileFormData && onSaveListingMedia ? true : false;

  const bodyContent = (
    <>
      {editableListingMedia && vendorUserId && profileFormData && onSaveListingMedia ? (
        <div>
          <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Listing photos
          </h4>
          <AdminListingMediaEditor
            vendorUserId={vendorUserId}
            profileFormData={profileFormData}
            portfolioImageUrls={submittedMedia.portfolioImageUrls}
            disabled={listingMediaDisabled}
            onSave={onSaveListingMedia}
          />
        </div>
      ) : null}
      <SubmittedMediaViewer
        bundle={submittedMedia}
        subjectName={businessName}
        profileInitials={initials}
        compact
        hideHeadings={!editableListingMedia}
        hideProfile={editableListingMedia}
        hidePortfolio={editableListingMedia}
      />
    </>
  );

  if (embedded) {
    return <div className="ez-stack ez-stack--sm">{bodyContent}</div>;
  }

  return (
    <Card as="section" className="overflow-hidden">
      <CardBody className="ez-stack ez-stack--sm">{bodyContent}</CardBody>
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-ink">{businessName}</p>
        <p className="mt-0.5 text-xs text-ink-3">{fullName}</p>
      </div>
    </Card>
  );
}
