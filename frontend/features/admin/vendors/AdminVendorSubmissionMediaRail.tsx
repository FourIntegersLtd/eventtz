"use client";

import { ContentCard, SectionSubheading } from "@/components/ui/SectionBlock";

type Props = {
  profileImageUrl: string | null;
  initials: string;
  businessName: string;
  fullName: string;
  portfolioUrls: string[];
};

export function AdminVendorSubmissionMediaRail({
  profileImageUrl,
  initials,
  businessName,
  fullName,
  portfolioUrls,
}: Props) {
  const safePortfolio = portfolioUrls ?? [];

  return (
    <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
      <ContentCard padding="none" className="overflow-hidden">
        {profileImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={profileImageUrl}
            alt=""
            className="aspect-square w-full bg-neutral-50 object-contain object-center"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-neutral-100">
            <span className="font-heading text-4xl font-semibold text-neutral-400">{initials}</span>
          </div>
        )}
        <div className="border-t border-neutral-100 px-5 py-4">
          <p className="text-sm font-semibold text-neutral-900">{businessName}</p>
          <p className="mt-0.5 text-[13px] text-neutral-500">{fullName}</p>
        </div>
      </ContentCard>

      <ContentCard>
        <SectionSubheading title="Portfolio" />
        <p className="mt-3 text-[13px] text-neutral-500">
          {safePortfolio.length > 0
            ? `${safePortfolio.length} photo${safePortfolio.length === 1 ? "" : "s"} submitted`
            : "No photos uploaded"}
        </p>
        {safePortfolio.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {safePortfolio.map((url, index) => (
              <div
                key={url}
                className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Portfolio ${index + 1}`}
                  className="max-h-full max-w-full object-contain object-center"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">
            Vendor has not uploaded portfolio photos yet.
          </p>
        )}
      </ContentCard>
    </aside>
  );
}
