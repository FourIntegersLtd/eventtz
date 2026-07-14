"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  EVENT_TYPE_OPTIONS,
  SERVICE_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  WEEKDAY_LABELS,
} from "../constants";
import { bioWordCount } from "../onboardingLogic";
import { getMarket } from "@/lib/markets";
import { radiusOptionsForMarket } from "@/lib/photonLocationAutocomplete";
import { STEP_COPY } from "../onboardingCopy";
import { VendorPortfolioThumbGrid } from "@/components/vendor/VendorPortfolioThumbGrid";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import type {
  TravelDeliveryPolicy,
  VendorOnboardingData,
  VendorOnboardingUpdate,
} from "../types";
import { inputClass, labelClass } from "./form-primitives";
import { OnboardingQuestionLayout } from "../ui/OnboardingQuestionLayout";
import { AnimatedStepItem } from "../ui/AnimatedStepItem";

const BIO_MAX_WORDS = 60;

const DELIVERY_LABELS: Record<string, string> = {
  travel_to_client: "I travel to the client",
  client_comes: "Clients come to me",
  ship_to_client: "I deliver to clients (e.g. courier)",
};

const TRAVEL_DELIVERY_POLICY_LABELS: Record<TravelDeliveryPolicy, string> = {
  fee_included: "Travel/delivery fee included",
  free_within_base_city:
    "Free delivery within base city (extra charges may apply outside this area)",
  fee_after_booking_request:
    "Travel/delivery fee will be provided after booking request",
  not_applicable: "Not applicable",
  custom: "Custom rule",
};

function labelsFromValues(
  values: string[],
  options: { value: string; label: string }[],
): string {
  if (values.length === 0) return "—";
  return values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .join(", ");
}

function ReviewSection({
  title,
  step,
  onNavigateToStep,
  children,
}: {
  title: string;
  step: number;
  onNavigateToStep: (step: number) => void;
  children: ReactNode;
}) {
  return (
    <details className={`group ${portalCard} transition-shadow open:shadow-md open:ring-primary/20`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <ChevronDown
            className="h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
          <span className="min-w-0 text-sm font-medium text-neutral-900">
            {title}
          </span>
        </span>
        <button
          type="button"
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNavigateToStep(step);
          }}
          aria-label={`Edit ${title}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </summary>
      <div className="border-t border-neutral-100 px-5 py-5 text-sm text-neutral-700">
        {children}
      </div>
    </details>
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
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
        {value}
      </div>
    </div>
  );
}

export type StepReviewProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  onRegenerateBio: () => void;
  onGenerateBioWithAI: () => void | Promise<void>;
  generatingBio?: boolean;
  onNavigateToStep: (step: number) => void;
  uploadingProfileImage?: boolean;
  profileImageError?: string | null;
  onUploadProfileImage: (file: File) => void | Promise<void>;
};

export function StepReview({
  data,
  update,
  onRegenerateBio,
  onGenerateBioWithAI,
  generatingBio,
  onNavigateToStep,
  uploadingProfileImage,
  profileImageError,
  onUploadProfileImage,
}: StepReviewProps) {
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const radiusLabel =
    radiusOptionsForMarket(getMarket(data.countryCode)).find(
      (o) => o.value === data.travelRadius,
    )?.label ?? "—";
  const deliveryLabel =
    data.deliveryModes.length === 0
      ? "—"
      : data.deliveryModes
          .map((m) => DELIVERY_LABELS[m] ?? m)
          .join(" · ");
  const wordCount = bioWordCount(data.aiBioDraft);
  const overLimit = wordCount > BIO_MAX_WORDS;
  const persistedPortfolioUrls = portfolioImageUrlsFromPayload({
    portfolioFileNames: data.portfolioFileNamesPersisted,
  });
  const portfolioImageCount =
    persistedPortfolioUrls.length + data.portfolioFiles.length;

  return (
    <div className="space-y-7">
      <OnboardingQuestionLayout
        headline={STEP_COPY[9].headline}
        subtext={STEP_COPY[9].subtext}
      />
      <AnimatedStepItem index={4}>
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            {data.profileImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.profileImageUrl}
                  alt="Profile"
                  className="h-24 w-24 rounded-full border border-neutral-200 object-cover object-center shadow-sm"
                />
              </>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-white">
                {(data.firstName[0] ?? "?") + (data.lastName[0] ?? "")}
              </div>
            )}
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingProfileImage}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadProfileImage(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Edit profile image"
              disabled={uploadingProfileImage}
              onClick={() => profileImageInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              {uploadingProfileImage ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="max-w-xs text-center text-xs text-neutral-500">
            This photo appears first on your public profile. Tap the pencil to upload or
            change it.
          </p>
          {profileImageError ? (
            <p className="text-xs text-red-600">{profileImageError}</p>
          ) : null}
        </div>
      </AnimatedStepItem>
      <AnimatedStepItem index={5}>
        <label className={labelClass()}>Public bio</label>
        <p className="mb-2 text-xs text-neutral-500">Short bio for your public profile.</p>
        <textarea
          className={`${inputClass()} min-h-[100px]`}
          value={data.aiBioDraft}
          onChange={(e) => update({ aiBioDraft: e.target.value })}
        />
        <p className={`mt-1 text-right text-xs ${overLimit ? "text-red-600" : "text-neutral-400"}`}>
          {wordCount}/{BIO_MAX_WORDS} words
        </p>
        <div className="mt-2 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap">
          <div className="flex-1 sm:flex-none">
            <button
              type="button"
              disabled={generatingBio}
              onClick={() => void onGenerateBioWithAI()}
              className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {generatingBio ? "Generating…" : "Generate bio with AI"}
            </button>
            <p className="mt-1 text-center text-[11px] text-neutral-500 sm:text-left">
              Writes a personalised bio from your profile details.
            </p>
          </div>
          <div className="flex-1 sm:flex-none">
            <button
              type="button"
              disabled={generatingBio}
              onClick={onRegenerateBio}
              className="w-full inline-flex items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Quick template (local)
            </button>
            <p className="mt-1 text-center text-[11px] text-neutral-500 sm:text-left">
              Editable starter text. No AI.
            </p>
          </div>
        </div>
      </AnimatedStepItem>

      <AnimatedStepItem index={6}>
      <ReviewSection
        title="Account"
        step={1}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Full name"
            value={[data.firstName, data.lastName].filter(Boolean).join(" ") || "—"}
          />
          <Field label="Email" value={data.email || "—"} />
          <Field label="Phone" value={data.phone || "—"} />
        </div>
      </ReviewSection>

      <ReviewSection
        title="Business"
        step={2}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business name" value={data.businessName || "—"} />
          <Field
            label="Services"
            value={labelsFromValues(data.servicesOffered, SERVICE_OPTIONS)}
          />
          <Field
            label="Event types"
            value={labelsFromValues(data.eventTypes, EVENT_TYPE_OPTIONS)}
          />
        </div>
      </ReviewSection>

      <ReviewSection
        title="Location & travel"
        step={3}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country" value={getMarket(data.countryCode).label} />
          <Field label="Base city" value={data.baseCity || "—"} />
          {data.region ? <Field label="Region" value={data.region} /> : null}
          {data.postalCode ? <Field label="Postcode" value={data.postalCode} /> : null}
          <Field label="Delivery modes" value={deliveryLabel} />
          <Field label="Travel radius" value={radiusLabel} />
          <Field
            label="Default policy"
            value={
              data.travelDeliveryPolicy
                ? data.travelDeliveryPolicy === "custom"
                  ? data.travelDeliveryPolicyCustomText || "Custom rule"
                  : TRAVEL_DELIVERY_POLICY_LABELS[data.travelDeliveryPolicy]
                : "—"
            }
          />
        </div>
      </ReviewSection>

      <ReviewSection
        title="Pricing"
        step={4}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hourly rate" value={`£${data.hourlyRate || "—"}`} />
          <Field label="Daily rate" value={`£${data.dailyRate || "—"}`} />
        </div>
        <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
          {data.packages.some(
            (p) =>
              p.title.trim() ||
              p.price.trim() ||
              p.details.trim() ||
              p.duration.trim(),
          ) ? (
            data.packages.map((p) => (
              <li key={p.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-neutral-700">
                <span className="font-medium text-neutral-900">
                  {p.title.trim() || "Untitled package"}
                </span>
                {p.price.trim() ? (
                  <span className="text-neutral-600"> — £{p.price}</span>
                ) : null}
                {p.duration.trim() ? (
                  <span className="text-neutral-500"> · {p.duration}</span>
                ) : null}
                {p.details.trim() ? (
                  <p className="mt-0.5 text-xs text-neutral-500">{p.details}</p>
                ) : null}
                <p className="mt-1 text-xs text-neutral-500">
                  Default travel rule:{" "}
                  {(p.useDefaultTravelPackage ?? true) ? "Yes" : "No"}
                </p>
              </li>
            ))
          ) : (
            <li className="text-neutral-500">No packages added</li>
          )}
        </ul>
        {data.offerDiscounts ? (
          <div className="mt-4 space-y-1 border-t border-neutral-100 pt-3 text-sm text-neutral-700">
            <p className="font-medium text-neutral-900">Discounts</p>
            {data.discountPercentage.trim() ? (
              <p>
                {data.discountPercentage.trim()}% off
                {data.discountLabel.trim() ? ` — ${data.discountLabel.trim()}` : ""}
                {" "}
                on listed prices
              </p>
            ) : null}
            {data.bulkDiscountThreshold.trim() && data.bulkDiscountPercent.trim() ? (
              <p>
                Extra {data.bulkDiscountPercent.trim()}% off over £
                {data.bulkDiscountThreshold.trim()}
              </p>
            ) : null}
            {data.offPeakDiscountPercent.trim() ? (
              <p>{data.offPeakDiscountPercent.trim()}% off off-peak dates</p>
            ) : null}
          </div>
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Availability"
        step={5}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Available days"
            value={
              data.availableWeekdays.length
                ? data.availableWeekdays
                    .map((i) => WEEKDAY_LABELS[i])
                    .join(", ")
                : "—"
            }
          />
          <Field label="Max bookings / day" value={data.maxBookingsPerDay || "—"} />
        </div>
      </ReviewSection>

      <ReviewSection
        title="Portfolio & links"
        step={6}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Portfolio images"
            value={
              portfolioImageCount
                ? `${portfolioImageCount} image(s) on file`
                : "No images yet"
            }
          />
          <Field
            label="Video"
            value={data.portfolioVideoNamePersisted ? "Uploaded" : "—"}
          />
          <Field
            label="Social links"
            value={
              data.socialLinks.length
                ? data.socialLinks
                    .map((s) => {
                      const platform =
                        SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === s.platform)
                          ?.label ?? s.platform;
                      return `${platform}: ${s.handle || "—"}`;
                    })
                    .join(", ")
                : "—"
            }
          />
        </div>
        {persistedPortfolioUrls.length > 0 ? (
          <VendorPortfolioThumbGrid urls={persistedPortfolioUrls} />
        ) : null}
        {data.socialLinks.length === 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            Add a social link to increase trust.
          </p>
        )}
      </ReviewSection>

      <ReviewSection
        title="Verification"
        step={7}
        onNavigateToStep={onNavigateToStep}
      >
        <Field
          label="Stripe Connect"
          value={
            data.stripeConnectStarted
              ? "Payout setup started."
              : "Payout setup not started yet."
          }
        />
      </ReviewSection>

      <ReviewSection
        title="Additional info"
        step={8}
        onNavigateToStep={onNavigateToStep}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Food hygiene certificate"
            value={data.foodHygieneCertNamePersisted ? "Uploaded" : "Not provided"}
          />
          <Field
            label="Indemnity / insurance"
            value={data.indemnityCertNamePersisted ? "Uploaded" : "Not provided"}
          />
          <Field label="Halal" value={data.isHalal ? "Yes" : "Not specified"} />
          <Field label="Allergen info" value={data.allergenInfo || "—"} />
        </div>
      </ReviewSection>
      </AnimatedStepItem>

      <AnimatedStepItem index={7}>
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
          I accept the platform&apos;s Terms &amp; Conditions, including food
          hygiene, allergen, and payment policies.
        </span>
      </label>
      </AnimatedStepItem>
    </div>
  );
}
