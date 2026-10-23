"use client";

import type { ReactNode } from "react";
import { BrowsePricingOptionCard } from "@/features/vendors/display/BrowsePricingOptionCard";
import { BrowsePricingPackagesSection } from "@/features/vendors/display/BrowsePricingPackagesSection";
import { BrowsePricingSharedInfo } from "@/features/vendors/display/BrowsePricingSharedInfo";
import {
  packageSpecificTravelLine,
  type BrowsePricingOption,
  type BrowsePricingSharedContext,
} from "@/lib/vendorBrowseDetailModel";
import { DescriptionList, DescriptionRow } from "@/components/ui/DescriptionList";
import { VendorPanelCard, VendorPanelSection } from "./vendorDetailsPanel";
import type { AdminSubmissionField } from "./adminVendorSubmissionReviewModel";

export const DetailSection = VendorPanelSection;
export const SubmissionCard = VendorPanelCard;

export function SubmissionFieldGrid({ fields }: { fields: AdminSubmissionField[] }) {
  const safeFields = fields ?? [];
  if (safeFields.length === 0) {
    return (
      <SubmissionCard>
        <p className="text-sm text-neutral-500">Nothing submitted.</p>
      </SubmissionCard>
    );
  }

  const midpoint = Math.ceil(safeFields.length / 2);
  const left = safeFields.slice(0, midpoint);
  const right = safeFields.slice(midpoint);

  return (
    <SubmissionCard>
      <dl>
        <div className="grid min-w-0 gap-0 sm:grid-cols-2">
          <div className="space-y-5 sm:border-r sm:border-neutral-100 sm:pr-6">
            {left.map((f) => (
              <DescriptionRow
                key={f.label}
                layout="stacked"
                label={f.label}
                value={f.value}
                missing={f.missing}
              />
            ))}
          </div>
          <div className="mt-5 space-y-5 border-t border-neutral-100 pt-5 sm:mt-0 sm:border-t-0 sm:pt-0 sm:pl-6">
            {right.map((f) => (
              <DescriptionRow
                key={f.label}
                layout="stacked"
                label={f.label}
                value={f.value}
                missing={f.missing}
              />
            ))}
          </div>
        </div>
      </dl>
    </SubmissionCard>
  );
}

export function SubmissionFieldRows({ fields }: { fields: AdminSubmissionField[] }) {
  const safeFields = fields ?? [];
  if (safeFields.length === 0) {
    return <p className="text-sm text-neutral-500">Nothing submitted.</p>;
  }

  return <DescriptionList rowLayout="split" items={safeFields} />;
}

export function SubmissionLabelRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-neutral-100 pt-5">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SubmissionPricingOptionsList({
  options,
  sharedContext,
  discountLines = [],
}: {
  options: BrowsePricingOption[];
  sharedContext: BrowsePricingSharedContext;
  discountLines?: string[];
}) {
  const safeOptions = options ?? [];
  const safeDiscounts = discountLines ?? [];
  const hasShared =
    Boolean(sharedContext.travelLine) ||
    sharedContext.serviceLines.length > 0 ||
    sharedContext.promoLines.length > 0;

  if (safeOptions.length === 0 && !hasShared && safeDiscounts.length === 0) {
    return <p className="text-sm text-neutral-500">No packages submitted.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {hasShared ? (
        <BrowsePricingSharedInfo
          {...sharedContext}
          variant="full"
          embedded
          className="!border-0 !p-0"
        />
      ) : null}
      {safeOptions.length > 0 ? (
        <BrowsePricingPackagesSection nested flush options={safeOptions}>
          {(opt) => (
            <BrowsePricingOptionCard
              opt={opt}
              packageTravelLine={packageSpecificTravelLine(opt, sharedContext)}
              hideFeatureLines={sharedContext.serviceLines.length > 0}
              hidePromoLines={sharedContext.promoLines.length > 0}
              detailsMode="always"
            />
          )}
        </BrowsePricingPackagesSection>
      ) : (
        <p className="text-sm text-neutral-500">No packages submitted.</p>
      )}
      {safeDiscounts.length > 0 ? (
        <SubmissionLabelRow label="Discounts">
          <ul className="space-y-2 text-sm text-neutral-700">
            {safeDiscounts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </SubmissionLabelRow>
      ) : null}
    </div>
  );
}
