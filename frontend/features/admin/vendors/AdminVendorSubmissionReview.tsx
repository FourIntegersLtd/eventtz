"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { TagPills } from "./vendorDetailsShared";
import { AdminVendorSubmissionChecklist } from "./AdminVendorSubmissionChecklist";
import { AdminVendorSubmissionMediaRail } from "./AdminVendorSubmissionMediaRail";
import {
  DetailSection,
  SubmissionCard,
  SubmissionFieldBlock,
  SubmissionFieldGrid,
  SubmissionFieldRows,
  SubmissionLabelRow,
} from "./AdminVendorSubmissionShared";
import type {
  AdminSubmissionField,
  AdminSubmissionPackage,
  AdminVendorSubmissionReviewModel,
} from "./adminVendorSubmissionReviewModel";

function PackageCard({ pkg }: { pkg: AdminSubmissionPackage }) {
  return (
    <li className="rounded-xl border border-neutral-100 border-l-[3px] border-l-primary bg-neutral-50 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">{pkg.title}</p>
        <p className="text-sm font-semibold tabular-nums text-neutral-900">{pkg.price}</p>
      </div>
      {pkg.duration !== "-" ? (
        <p className="mt-0.5 text-xs text-neutral-500">{pkg.duration}</p>
      ) : null}
      {pkg.details ? (
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{pkg.details}</p>
      ) : null}
      <p className="mt-2 text-xs text-neutral-500">Travel: {pkg.travel}</p>
    </li>
  );
}

function ConfirmationRow({ label, accepted }: { label: string; accepted: boolean }) {
  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      {accepted ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      )}
      <div className="min-w-0">
        <p className={`text-sm ${accepted ? "text-neutral-800" : "font-medium text-amber-900"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {accepted ? "Confirmed by vendor" : "Not confirmed"}
        </p>
      </div>
    </div>
  );
}

function splitPortfolioFields(fields: AdminSubmissionField[]) {
  const safe = fields ?? [];
  const socialLinks = safe.find((f) => f.label === "Social links");
  const mediaFacts = safe.filter((f) => f.label !== "Social links");
  return { socialLinks, mediaFacts };
}

type Props = {
  model: AdminVendorSubmissionReviewModel;
};

export function AdminVendorSubmissionReview({ model }: Props) {
  const checklistGroups = model.checklistGroups ?? [];
  const reachFields = model.reachFields ?? [];
  const locationFields = model.locationFields ?? [];
  const pricingFields = model.pricingFields ?? [];
  const packages = model.packages ?? [];
  const discountLines = model.discountLines ?? [];
  const availabilityFields = model.availabilityFields ?? [];
  const portfolioUrls = model.portfolioUrls ?? [];
  const portfolioFields = model.portfolioFields ?? [];
  const additionalFields = model.additionalFields ?? [];
  const serviceLabels = model.serviceLabels ?? [];
  const eventTypeLabels = model.eventTypeLabels ?? [];
  const confirmations = model.confirmations ?? [];

  const { socialLinks, mediaFacts } = splitPortfolioFields(portfolioFields);

  const identityFields: AdminSubmissionField[] = [
    { label: "Contact name", value: model.fullName },
    { label: "Business name", value: model.businessName },
    ...reachFields,
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="min-w-0 space-y-8">
        <AdminVendorSubmissionChecklist groups={checklistGroups} />

        <div className="space-y-8">
          <DetailSection
            id="submission-identity"
            title="Identity & contact"
            description="Login and business contact details"
          >
            <SubmissionFieldGrid fields={identityFields} />
          </DetailSection>

          <DetailSection
            id="submission-listing"
            title="Listing content"
            description="Public bio, services, and event types"
          >
            <SubmissionCard>
              <dl>
                <SubmissionFieldBlock
                  label="Public bio"
                  value={model.bio}
                  missing={model.bioMissing}
                />
              </dl>
              <SubmissionLabelRow label="Services">
                <TagPills items={serviceLabels} />
              </SubmissionLabelRow>
              <SubmissionLabelRow label="Event types">
                <TagPills items={eventTypeLabels} />
              </SubmissionLabelRow>
              {socialLinks ? (
                <SubmissionLabelRow label="Social links">
                  <p className="text-sm text-neutral-800">{socialLinks.value}</p>
                </SubmissionLabelRow>
              ) : null}
            </SubmissionCard>
          </DetailSection>

          <DetailSection
            id="submission-pricing"
            title="Pricing & packages"
            description="Rates, packages, and discounts"
          >
            <SubmissionFieldGrid fields={pricingFields} />
            <SubmissionCard>
              {packages.length > 0 ? (
                <ul className="space-y-4">
                  {packages.map((pkg) => (
                    <PackageCard key={`${pkg.title}-${pkg.price}`} pkg={pkg} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">No packages submitted.</p>
              )}
              {discountLines.length > 0 ? (
                <ul className="mt-6 space-y-2 border-t border-neutral-100 pt-6 text-sm text-neutral-700">
                  <li className="text-[13px] font-medium text-neutral-500">Discounts</li>
                  {discountLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </SubmissionCard>
          </DetailSection>

          <DetailSection
            id="submission-availability"
            title="Portfolio & availability"
            description="Location, travel, schedule, and supporting media"
          >
            <SubmissionFieldGrid fields={locationFields} />
            <SubmissionCard>
              <SubmissionFieldRows fields={availabilityFields} />
              {mediaFacts.length > 0 ? (
                <div className="mt-6 border-t border-neutral-100 pt-6">
                  <SubmissionFieldRows fields={mediaFacts} />
                </div>
              ) : null}
              {model.hasAdditionalInfo ? (
                <div className="mt-6 border-t border-neutral-100 pt-6">
                  <p className="mb-3 text-[13px] font-medium text-neutral-500">
                    Documents & dietary info
                  </p>
                  <SubmissionFieldRows fields={additionalFields} />
                </div>
              ) : null}
            </SubmissionCard>
          </DetailSection>

          <DetailSection
            id="submission-legal"
            title="Legal confirmations"
            description="Vendor attestations at submission"
          >
            <SubmissionCard>
              <div className="divide-y divide-neutral-100">
                {confirmations.map((item) => (
                  <ConfirmationRow
                    key={item.label}
                    label={item.label}
                    accepted={item.accepted}
                  />
                ))}
              </div>
            </SubmissionCard>
          </DetailSection>
        </div>
      </div>

      <AdminVendorSubmissionMediaRail
        profileImageUrl={model.profileImageUrl}
        initials={model.initials}
        businessName={model.businessName}
        fullName={model.fullName}
        portfolioUrls={portfolioUrls}
      />
    </div>
  );
}
