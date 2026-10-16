"use client";

import { ContentCard } from "@/components/ui/SectionBlock";
import { contentCardPadding } from "@/components/ui/sectionBlockTokens";
import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  AdminListingMediaEditor,
} from "@/features/admin/vendors/AdminListingMediaEditor";
import { SubmittedMediaViewer } from "@/features/admin/vendors/SubmittedMediaViewer";
import type { SubmittedMediaBundle } from "@/lib/submittedMediaUtils";

type Props = {
  initials: string;
  businessName: string;
  fullName: string;
  submittedMedia: SubmittedMediaBundle;
  vendorUserId?: string;
  profileFormData?: Record<string, unknown>;
  listingMediaDisabled?: boolean;
  onSaveListingMedia?: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
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
}: Props) {
  const editableListingMedia =
    vendorUserId && profileFormData && onSaveListingMedia ? true : false;

  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <ContentCard padding="none" className="overflow-hidden">
        <div className={`${contentCardPadding} space-y-6`}>
          {editableListingMedia && vendorUserId && profileFormData && onSaveListingMedia ? (
            <div>
              <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
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
        </div>
        <div className="border-t border-neutral-100 px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-sm font-semibold text-neutral-900">{businessName}</p>
          <p className="mt-0.5 text-[13px] text-neutral-500">{fullName}</p>
        </div>
      </ContentCard>
    </aside>
  );
}
