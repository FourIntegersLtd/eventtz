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
  SubmissionPricingOptionsList,
} from "./AdminVendorSubmissionShared";
import type {
  AdminSubmissionField,
  AdminVendorSubmissionReviewModel,
} from "./adminVendorSubmissionReviewModel";

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
  return { socialLinks };
}

type Props = {
  model: AdminVendorSubmissionReviewModel;
};

export function AdminVendorSubmissionReview({ model }: Props) {
  const checklistGroups = model.checklistGroups ?? [];
  const reachFields = model.reachFields ?? [];
  const locationFields = model.locationFields ?? [];
  const pricingFields = model.pricingFields ?? [];
  const pricingOptions = model.pricingOptions ?? [];
  const pricingSharedContext = model.pricingSharedContext ?? {
    travelLine: null,
    serviceLines: [],
    promoLines: [],
  };
  const discountLines = model.discountLines ?? [];
  const availabilityFields = model.availabilityFields ?? [];
  const portfolioFields = model.portfolioFields ?? [];
  const submittedMedia = model.submittedMedia;
  const additionalFields = model.additionalFields ?? [];
  const serviceLabels = model.serviceLabels ?? [];
  const eventTypeLabels = model.eventTypeLabels ?? [];
  const confirmations = model.confirmations ?? [];

  const { socialLinks } = splitPortfolioFields(portfolioFields);

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
              <SubmissionPricingOptionsList
                options={pricingOptions}
                sharedContext={pricingSharedContext}
              />
              {discountLines.length > 0 ? (
                <SubmissionLabelRow label="Discounts">
                  <ul className="space-y-2 text-sm text-neutral-700">
                    {discountLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </SubmissionLabelRow>
              ) : null}
            </SubmissionCard>
          </DetailSection>

          <DetailSection
            id="submission-availability"
            title="Portfolio & availability"
            description="Location, travel, and schedule"
          >
            <SubmissionFieldGrid fields={locationFields} />
            <SubmissionCard>
              <SubmissionFieldRows fields={availabilityFields} />
              {additionalFields.length > 0 ? (
                <div className="mt-6 border-t border-neutral-100 pt-6">
                  <p className="mb-3 text-[13px] font-medium text-neutral-500">Dietary info</p>
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
        initials={model.initials}
        businessName={model.businessName}
        fullName={model.fullName}
        submittedMedia={submittedMedia}
      />
    </div>
  );
}
