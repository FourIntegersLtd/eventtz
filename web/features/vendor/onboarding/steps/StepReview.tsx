"use client";

import { type ReactNode } from "react";
import { Pencil, Sparkles } from "lucide-react";
import {
  SOCIAL_PLATFORM_OPTIONS,
  WEEKDAY_LABELS,
} from "../../../../lib/vendorOnboarding/constants";
import { bioWordCount } from "../onboardingLogic";
import { isConfiguredPackage } from "../../../../lib/vendorOnboarding/packageQuality";
import {
  formatDiscountSummary,
  formatReviewBlockedDates,
  formatReviewDeliveryModes,
  formatReviewEventTypes,
  formatReviewPackagePrice,
  formatReviewPackageQuantityBounds,
  formatReviewServices,
  hasAdditionalInfoContent,
  hasPortfolioContent,
  packageTravelPolicyLabel,
} from "../../../../lib/vendorOnboarding/reviewDisplayHelpers";
import { getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { VendorPortfolioThumbGrid } from "@/features/vendors/display/VendorPortfolioThumbGrid";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import type {
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../../../../lib/vendorOnboarding/types";
import { ClearableTextarea, labelClass } from "../../../../components/ui/form-primitives";
import { uploadedFileDisplayName } from "../../../../lib/vendorOnboarding/uploadedFileDisplayName";
import { ReviewCards } from "./ReviewCards";
import { vendorCancellationPolicyLabel } from "@/features/bookings/cancellationPolicyCopy";
import { VendorProfilePhotoField } from "../VendorProfilePhotoField";

const BIO_MAX_WORDS = 100;

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

const TRAVEL_DELIVERY_POLICY_LABELS: Record<TravelDeliveryPolicy, string> = {
  fee_included: "Travel/delivery fee included",
  free_within_base_city:
    "Free delivery within base city (extra charges may apply outside this area)",
  fee_after_booking_request:
    "Travel/delivery fee will be provided after booking request",
  not_applicable: "Not applicable",
  custom: "Custom rule",
};

function ReviewSection({
  title,
  step,
  onNavigateToStep,
  children,
  isLiveEdit,
  readOnly,
}: {
  title: string;
  step: number;
  onNavigateToStep: (step: number) => void;
  children: ReactNode;
  isLiveEdit: boolean;
  readOnly?: boolean;
}) {
  const editButton = readOnly ? null : (
    <button
      type="button"
      className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
      onClick={() => onNavigateToStep(step)}
      aria-label={`Edit ${title}`}
    >
      <Pencil className="h-4 w-4" />
    </button>
  );

  if (readOnly) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
          {children}
        </div>
      </section>
    );
  }

  if (isLiveEdit) {
    return (
      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          {editButton}
        </div>
        <div className="border-t border-neutral-100">{children}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-100">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
        {editButton}
      </div>
      <div className="border-t border-neutral-100">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      data-review-field
      className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-6"
    >
      <dt className="shrink-0 text-[13px] text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-neutral-900 sm:text-right">
        {value}
      </dd>
    </div>
  );
}

function FieldList({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <dl
      className={
        compact
          ? "divide-y divide-neutral-100 [&_[data-review-field]]:px-4 [&_[data-review-field]]:py-3"
          : "divide-y divide-neutral-100"
      }
    >
      {children}
    </dl>
  );
}

export type StepReviewProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  onGenerateBioWithAI: () => void | Promise<void>;
  generatingBio?: boolean;
  onNavigateToStep: (step: number) => void;
  uploadingProfileImage?: boolean;
  profileImageError?: string | null;
  onUploadProfileImage: (file: File) => void | Promise<void>;
  isLiveEdit?: boolean;
  /** Admin / audit view — same layout as step 8, no edits or uploads. */
  readOnly?: boolean;
  /** Allow profile photo changes even when the rest of the review is read-only. */
  profilePhotoEditable?: boolean;
};

export function StepReview({
  data,
  update,
  onGenerateBioWithAI,
  generatingBio,
  onNavigateToStep,
  uploadingProfileImage,
  profileImageError,
  onUploadProfileImage,
  isLiveEdit = false,
  readOnly = false,
  profilePhotoEditable = false,
}: StepReviewProps) {
  const radiusLabel =
    radiusOptionsForMarket(getMarket(data.countryCode)).find(
      (o) => o.value === data.travelRadius,
    )?.label ?? "-";
  const deliveryLabel = formatReviewDeliveryModes(data.deliveryModes);
  const wordCount = bioWordCount(data.aiBioDraft);
  const overLimit = wordCount > BIO_MAX_WORDS;
  const blockedDatesLabel = formatReviewBlockedDates(data.blockedDates);
  const discountLines = formatDiscountSummary(data);
  const persistedPortfolioUrls = portfolioImageUrlsFromPayload({
    portfolioFileNames: data.portfolioFileNamesPersisted,
  });
  const portfolioImageCount =
    persistedPortfolioUrls.length + data.portfolioFiles.length;

  const hasPackages = data.packages.some((p) => isConfiguredPackage(p));
  const configuredPackages = data.packages.filter((p) => isConfiguredPackage(p));

  const profilePhotoBlock = (
    <VendorProfilePhotoField
      firstName={data.firstName}
      lastName={data.lastName}
      profileImageUrl={data.profileImageUrl}
      editable={profilePhotoEditable || !readOnly}
      uploading={uploadingProfileImage}
      error={profileImageError}
      onUpload={onUploadProfileImage}
    />
  );

  const bioBlock = readOnly ? (
    <div className="space-y-3">
      <p className="min-h-[60px] whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
        {data.aiBioDraft.trim() || "-"}
      </p>
      <p className="text-right text-xs text-neutral-400">
        {wordCount}/{BIO_MAX_WORDS} words
      </p>
    </div>
  ) : (
    <div className="space-y-3">
      <ClearableTextarea
        className="min-h-[100px]"
        value={data.aiBioDraft}
        onChange={(v) => update({ aiBioDraft: v })}
      />
      <p
        className={`text-right text-xs ${overLimit ? "text-red-600" : "text-neutral-400"}`}
      >
        {wordCount}/{BIO_MAX_WORDS} words
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={generatingBio}
          onClick={() => void onGenerateBioWithAI()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {generatingBio ? "Generating…" : "Generate bio with AI"}
        </button>
      </div>
    </div>
  );

  const reviewSections = (
    <>
      <ReviewSection
        title="Account"
        step={1}
        onNavigateToStep={onNavigateToStep}
        isLiveEdit={isLiveEdit}
        readOnly={readOnly}
      >
        <FieldList compact={!isLiveEdit}>
          <Field
            label="Full name"
            value={
              [data.firstName, data.lastName].filter(Boolean).join(" ") || "-"
            }
          />
          <Field label="Email" value={data.email || "-"} />
          <Field label="Phone" value={data.phone || "-"} />
        </FieldList>
      </ReviewSection>

      <ReviewSection
        title="Business"
        step={2}
        onNavigateToStep={onNavigateToStep}
        isLiveEdit={isLiveEdit}
        readOnly={readOnly}
      >
        <FieldList compact={!isLiveEdit}>
          <Field label="Business name" value={data.businessName || "-"} />
          <Field label="Services" value={formatReviewServices(data.servicesOffered)} />
          <Field label="Event types" value={formatReviewEventTypes(data.eventTypes)} />
        </FieldList>
      </ReviewSection>

      <ReviewSection
        title="Location & travel"
        step={3}
        onNavigateToStep={onNavigateToStep}
        isLiveEdit={isLiveEdit}
        readOnly={readOnly}
      >
        <FieldList compact={!isLiveEdit}>
          <Field label="Country" value={getMarket(data.countryCode).label} />
          <Field label="Base city" value={data.baseCity || "-"} />
          {readOnly || data.region ? (
            <Field label="Region" value={data.region || "-"} />
          ) : null}
          {readOnly || data.postalCode ? (
            <Field label="Postcode" value={data.postalCode || "-"} />
          ) : null}
          <Field label="Delivery modes" value={deliveryLabel} />
          <Field label="Travel radius" value={radiusLabel} />
          <Field
            label="Default policy"
            value={
              data.travelDeliveryPolicy
                ? data.travelDeliveryPolicy === "custom"
                  ? data.travelDeliveryPolicyCustomText || "Custom rule"
                  : TRAVEL_DELIVERY_POLICY_LABELS[data.travelDeliveryPolicy]
                : "-"
            }
          />
        </FieldList>
      </ReviewSection>

      <ReviewSection
        title="Pricing"
        step={4}
        onNavigateToStep={onNavigateToStep}
        isLiveEdit={isLiveEdit}
        readOnly={readOnly}
      >
        <FieldList compact={!isLiveEdit}>
          <Field label="Hourly rate" value={`£${data.hourlyRate || "-"}`} />
          <Field label="Daily rate" value={`£${data.dailyRate || "-"}`} />
          <Field label="Cancellation policy" value={vendorCancellationPolicyLabel(data.cancellationPolicy)} />
          {readOnly ? (
            <>
              <Field
                label="Default travel rule for hourly"
                value={yesNo(data.useDefaultTravelHourly)}
              />
              <Field
                label="Default travel rule for daily"
                value={yesNo(data.useDefaultTravelDaily)}
              />
              <Field label="Offers discounts" value={yesNo(data.offerDiscounts)} />
            </>
          ) : null}
        </FieldList>
        <div className="border-t border-neutral-100">
          <p className="px-5 pt-4 text-[13px] font-medium text-neutral-500 sm:px-6">
            Packages
          </p>
          {readOnly || hasPackages ? (
            configuredPackages.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {configuredPackages.map((p) => {
                const priceLabel = formatReviewPackagePrice(p);
                const quantityBounds = formatReviewPackageQuantityBounds(p);
                return (
                <li
                  key={p.id}
                  className="px-5 py-3.5 text-sm text-neutral-700 sm:px-6"
                >
                  <span className="font-medium text-neutral-900">
                    {p.title.trim() || "Untitled package"}
                  </span>
                  {priceLabel ? (
                    <span className="text-neutral-600"> - {priceLabel}</span>
                  ) : null}
                  {quantityBounds ? (
                    <span className="text-neutral-500"> · {quantityBounds}</span>
                  ) : null}
                  {p.duration.trim() ? (
                    <span className="text-neutral-500"> · {p.duration}</span>
                  ) : null}
                  {p.details.trim() ? (
                    <p className="mt-0.5 text-xs text-neutral-500">{p.details}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-neutral-500">
                    Travel:{" "}
                    {packageTravelPolicyLabel(
                      data,
                      p.useDefaultTravelPackage ?? true,
                    )}
                  </p>
                </li>
                );
              })}
            </ul>
            ) : (
              <p className="px-5 py-3.5 text-sm text-neutral-500 sm:px-6">
                No packages added
              </p>
            )
          ) : (
            <p className="px-5 py-3.5 text-sm text-neutral-500 sm:px-6">
              No packages added
            </p>
          )}
        </div>
        {(readOnly && data.offerDiscounts) || (!readOnly && data.offerDiscounts) ? (
          <div className="space-y-1 border-t border-neutral-100 px-5 py-3.5 text-sm text-neutral-700 sm:px-6">
            <p className="font-medium text-neutral-900">Discounts</p>
            {discountLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Availability"
        step={6}
        onNavigateToStep={onNavigateToStep}
        isLiveEdit={isLiveEdit}
        readOnly={readOnly}
      >
        <FieldList compact={!isLiveEdit}>
          <Field
            label="Available days"
            value={
              data.availableWeekdays.length
                ? data.availableWeekdays.map((i) => WEEKDAY_LABELS[i]).join(", ")
                : "-"
            }
          />
          <Field
            label="Max bookings / day"
            value={data.maxBookingsPerDay || "-"}
          />
          {readOnly || blockedDatesLabel ? (
            <Field label="Blocked dates" value={blockedDatesLabel ?? "-"} />
          ) : null}
        </FieldList>
      </ReviewSection>

      {(readOnly || hasPortfolioContent(data)) ? (
        <ReviewSection
          title="Portfolio & links"
          step={7}
          onNavigateToStep={onNavigateToStep}
          isLiveEdit={isLiveEdit}
          readOnly={readOnly}
        >
          <FieldList compact={!isLiveEdit}>
            {readOnly || portfolioImageCount > 0 ? (
              <Field
                label="Portfolio images"
                value={
                  portfolioImageCount > 0
                    ? `${portfolioImageCount} image(s) on file`
                    : "-"
                }
              />
            ) : null}
            {readOnly || data.portfolioVideoNamesPersisted.length > 0 ? (
              <Field
                label="Videos"
                value={
                  data.portfolioVideoNamesPersisted.length
                    ? data.portfolioVideoNamesPersisted
                        .map((url) =>
                          uploadedFileDisplayName(url, data.uploadedFileLabels, "Video"),
                        )
                        .join(", ")
                    : "-"
                }
              />
            ) : null}
            {readOnly || data.socialLinks.length > 0 ? (
              <Field
                label="Social links"
                value={
                  data.socialLinks.length
                    ? data.socialLinks
                        .map((s) => {
                          const platform =
                            SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === s.platform)
                              ?.label ?? s.platform;
                          return `${platform}: ${s.handle || "-"}`;
                        })
                        .join(", ")
                    : "-"
                }
              />
            ) : null}
          </FieldList>
          {persistedPortfolioUrls.length > 0 ? (
            <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
              <VendorPortfolioThumbGrid urls={persistedPortfolioUrls} />
            </div>
          ) : null}
        </ReviewSection>
      ) : null}

      {(readOnly || hasAdditionalInfoContent(data)) ? (
        <ReviewSection
          title="Additional info"
          step={8}
          onNavigateToStep={onNavigateToStep}
          isLiveEdit={isLiveEdit}
          readOnly={readOnly}
        >
          <FieldList compact={!isLiveEdit}>
            {readOnly || data.foodHygieneCertNamePersisted ? (
              <Field
                label="Food hygiene certificate"
                value={
                  data.foodHygieneCertNamePersisted
                    ? uploadedFileDisplayName(
                        data.foodHygieneCertNamePersisted,
                        data.uploadedFileLabels,
                        "Food hygiene certificate",
                      )
                    : "-"
                }
              />
            ) : null}
            {readOnly || data.indemnityCertNamePersisted ? (
              <Field
                label="Indemnity / insurance"
                value={
                  data.indemnityCertNamePersisted
                    ? uploadedFileDisplayName(
                        data.indemnityCertNamePersisted,
                        data.uploadedFileLabels,
                        "Indemnity / insurance certificate",
                      )
                    : "-"
                }
              />
            ) : null}
            {readOnly ? (
              <>
                <Field label="Halal" value={yesNo(data.isHalal)} />
                <Field label="Vegan" value={yesNo(data.isVegan)} />
                <Field label="Vegetarian" value={yesNo(data.isVegetarian)} />
                <Field label="Gluten-free" value={yesNo(data.isGlutenFree)} />
                <Field
                  label="Allergen info"
                  value={data.allergenInfo.trim() || "-"}
                />
                <Field
                  label="Other documents"
                  value={
                    data.otherDocsNamesPersisted.length
                      ? data.otherDocsNamesPersisted
                          .map((url) =>
                            uploadedFileDisplayName(
                              url,
                              data.uploadedFileLabels,
                              "Document",
                            ),
                          )
                          .join(", ")
                      : "-"
                  }
                />
              </>
            ) : (
              <>
                {data.isHalal ? <Field label="Halal" value="Yes" /> : null}
                {data.isVegan ? <Field label="Vegan" value="Yes" /> : null}
                {data.isVegetarian ? (
                  <Field label="Vegetarian" value="Yes" />
                ) : null}
                {data.isGlutenFree ? (
                  <Field label="Gluten-free" value="Yes" />
                ) : null}
                {data.allergenInfo.trim() ? (
                  <Field label="Allergen info" value={data.allergenInfo.trim()} />
                ) : null}
              </>
            )}
          </FieldList>
        </ReviewSection>
      ) : null}
    </>
  );

  const confirmations = readOnly ? (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={data.confirmTruthful}
          disabled
          readOnly
          className="mt-0.5"
        />
        <span>I confirm that all provided details are truthful.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={data.confirmTerms}
          disabled
          readOnly
          className="mt-0.5"
        />
        <span>
          I accept the Platform&apos;s Terms of Service and Legal Policies.
        </span>
      </label>
    </div>
  ) : (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={data.confirmTruthful}
          onChange={(e) => update({ confirmTruthful: e.target.checked })}
          className="mt-0.5"
        />
        <span>I confirm that all provided details are truthful.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={data.confirmTerms}
          onChange={(e) => update({ confirmTerms: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          I accept the Platform&apos;s Terms of Service and Legal Policies.
        </span>
      </label>
    </div>
  );

  if (readOnly) {
    return (
      <div className="space-y-7">
        {profilePhotoBlock}
        <div>
          <label className={labelClass()}>Public bio</label>
          <p className="mb-2 text-xs text-neutral-500">
            Short bio for your public profile.
          </p>
          {bioBlock}
        </div>
        <div className="space-y-3">{reviewSections}</div>
        {confirmations}
      </div>
    );
  }

  if (isLiveEdit) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-neutral-900">
            Review
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Check your listing, then edit a section or save.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Profile photo
            </h2>
            <p className="mt-0.5 text-[13px] text-neutral-400">
              Shown first on your public profile.
            </p>
          </div>
          <div className="border-t border-neutral-100 px-5 py-6 sm:px-6">
            {profilePhotoBlock}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Public bio
            </h2>
            <p className="mt-0.5 text-[13px] text-neutral-400">
              Short bio for your public profile.
            </p>
          </div>
          <div className="border-t border-neutral-100 px-5 py-5 sm:px-6">
            {bioBlock}
          </div>
        </section>

        {reviewSections}

        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white px-5 py-5 sm:px-6">
          {confirmations}
        </section>
      </div>
    );
  }

  return (
    <div className="ez-stack">
      <ReviewCards data={data} update={update} onNavigateToStep={onNavigateToStep} />
      {/* Not in design V08, which has no bio or photo here; kept so the bio can still be written. */}
      <div data-design-extra="bio-photo" className="ez-stack">
        {profilePhotoBlock}
        <div>
          <label className={labelClass()}>Public bio</label>
          <p className="mb-2 text-xs text-neutral-500">Short bio for your public profile.</p>
          {bioBlock}
        </div>
      </div>
    </div>
  );
}
