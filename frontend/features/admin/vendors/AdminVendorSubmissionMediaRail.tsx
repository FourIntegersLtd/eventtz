"use client";

import { ContentCard } from "@/components/ui/SectionBlock";
import { contentCardPadding } from "@/components/ui/sectionBlockTokens";
import { SubmittedMediaViewer } from "@/components/ui/SubmittedMediaViewer";
import type { SubmittedMediaBundle } from "@/lib/submittedMediaUtils";

type Props = {
  initials: string;
  businessName: string;
  fullName: string;
  submittedMedia: SubmittedMediaBundle;
};

export function AdminVendorSubmissionMediaRail({
  initials,
  businessName,
  fullName,
  submittedMedia,
}: Props) {
  return (
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <ContentCard padding="none" className="overflow-hidden">
        <div className={contentCardPadding}>
          <SubmittedMediaViewer
            bundle={submittedMedia}
            subjectName={businessName}
            profileInitials={initials}
            compact
            hideHeadings
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
