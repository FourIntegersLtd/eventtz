"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { AdminListingMediaSavePayload, AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import { TagPills } from "./vendorDetailsShared";
import { AdminVendorSubmissionChecklist } from "./AdminVendorSubmissionChecklist";
import { AdminVendorSubmissionActions } from "./AdminVendorSubmissionActions";
import { AdminVendorSubmissionMediaRail } from "./AdminVendorSubmissionMediaRail";
import { VendorConsequencesSection } from "./VendorConsequencesSection";
import { VendorDetailsApprovalSection } from "./VendorDetailsApprovalSection";
import { VendorInsuranceSection } from "./VendorInsuranceSection";
import { VendorStripeConnectSection } from "./VendorStripeConnectSection";
import { DescriptionRow } from "@/components/ui/DescriptionList";
import {
  DetailSection,
  SubmissionCard,
  SubmissionFieldGrid,
  SubmissionFieldRows,
  SubmissionLabelRow,
  SubmissionPricingOptionsList,
} from "./AdminVendorSubmissionShared";
import type {
  AdminSubmissionField,
  AdminVendorSubmissionReviewModel,
} from "./adminVendorSubmissionReviewModel";
import type { AdminVendorUnsubmitHandler } from "./vendorUnsubmitTypes";
import { Card } from "@/components/ui/Card";

function ConfirmationRow({ label, accepted }: { label: string; accepted: boolean }) {
  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      {accepted ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      )}
      <div className="min-w-0">
        <p className={`text-sm ${accepted ? "text-ink" : "font-medium text-warning"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">
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

export type AdminVendorSubmissionReviewPanel = "submission" | "staff";

type Props = {
  model: AdminVendorSubmissionReviewModel;
  /** Submission wizard fields, or staff review actions (tabs keep these separate). */
  panel: AdminVendorSubmissionReviewPanel;
  vendor?: AdminVendorRow;
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

/** Vendor submission review: submission fields and/or staff decision panels (one panel per tab). */
export function AdminVendorSubmissionReview({
  model,
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

  const showStaffAside = Boolean(vendor && onSetApproval && onSetListingOverride);

  const submissionReviewPanel = (
    <Card as="section" className="overflow-hidden">
      <Card.Header>
        <h2 className="ez-h3">Review checklist</h2>
        <p className="ez-small mt-1">
          Work through gaps here, then use <strong className="font-medium text-ink">Actions</strong> to
          approve or update listing status.
        </p>
      </Card.Header>
      <Card.Body className="flex flex-col gap-4">
        {vendor && onUnsubmit ? (
          <AdminVendorSubmissionActions
            vendor={vendor}
            checklistGroups={checklistGroups}
            businessName={model.businessName}
            busyId={busyId ?? null}
            onUnsubmit={onUnsubmit}
            onReportError={onReportError}
          />
        ) : null}
        <AdminVendorSubmissionChecklist groups={checklistGroups} embedded />
      </Card.Body>
    </Card>
  );

  const submissionContent = (
    <div className="flex flex-col gap-8">
      {submissionReviewPanel}

      <DetailSection
        id="submission-contact"
        title="Contact"
        description="Account holder and how clients can reach them"
      >
        <SubmissionFieldGrid fields={identityFields} />
      </DetailSection>

      <DetailSection
        id="submission-listing"
        title="Business & listing"
        description="What clients see on explore and the public profile"
      >
        <SubmissionCard>
          <dl>
            <DescriptionRow
              layout="block"
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
              <p className="text-sm text-ink">{socialLinks.value}</p>
            </SubmissionLabelRow>
          ) : null}
        </SubmissionCard>
      </DetailSection>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <DetailSection
          id="submission-location"
          title="Location & travel"
          description="Where they operate and how far they travel"
        >
          <SubmissionFieldGrid fields={locationFields} />
        </DetailSection>

        <DetailSection
          id="submission-availability"
          title="Availability"
          description="Days, capacity, and blocked dates"
        >
          <SubmissionCard>
            <SubmissionFieldRows fields={availabilityFields} />
          </SubmissionCard>
        </DetailSection>
      </div>

      <DetailSection
        id="submission-pricing"
        title="Pricing"
        description="Rates, cancellation, packages, and discounts"
      >
        <SubmissionFieldGrid fields={pricingFields} />
        <SubmissionCard>
          <SubmissionPricingOptionsList
            options={pricingOptions}
            sharedContext={pricingSharedContext}
            discountLines={discountLines}
          />
        </SubmissionCard>
      </DetailSection>

      {additionalFields.length > 0 ? (
        <DetailSection
          id="submission-additional"
          title="Additional information"
          description="Dietary and allergen details for catering-style listings"
        >
          <SubmissionCard>
            <SubmissionFieldRows fields={additionalFields} />
          </SubmissionCard>
        </DetailSection>
      ) : null}

      <DetailSection
        id="submission-media"
        title="Photos & documents"
        description="Profile, portfolio, videos, and uploaded files"
      >
        <AdminVendorSubmissionMediaRail
          embedded
          initials={model.initials}
          businessName={model.businessName}
          fullName={model.fullName}
          submittedMedia={submittedMedia}
          vendorUserId={vendor?.user_id}
          profileFormData={vendor?.profile_form_data}
          listingMediaDisabled={busyId === vendor?.user_id}
          onSaveListingMedia={onSaveListingMedia}
        />
      </DetailSection>

      <DetailSection
        id="submission-legal"
        title="Legal confirmations"
        description="Attestations at submission"
      >
        <SubmissionCard>
          <div className="divide-y divide-line">
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
  );

  const staffContent =
    showStaffAside && vendor ? (
      <div className="ez-split">
        <div className="ez-split__main flex flex-col gap-8">
          <VendorDetailsApprovalSection
            vendor={vendor}
            busyId={busyId ?? null}
            onSetApproval={onSetApproval!}
            onSetListingOverride={onSetListingOverride!}
          />

          <VendorConsequencesSection vendor={vendor} />
        </div>

        <div className="ez-split__aside flex flex-col gap-8">
          <VendorStripeConnectSection
            vendor={vendor}
            busy={busyId === vendor.user_id}
            onRestoreStripe={onRestoreStripe}
          />
          <VendorInsuranceSection key={vendor.user_id} vendor={vendor} />
        </div>
      </div>
    ) : null;

  if (panel === "submission") {
    return submissionContent;
  }

  if (!staffContent) {
    return (
      <p className="text-sm text-ink-2">Staff actions are not available for this vendor.</p>
    );
  }

  return staffContent;
}
