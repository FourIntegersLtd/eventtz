"use client";

import Link from "next/link";
import { ONBOARDING_STEP } from "./onboardingProgress";
import { useEffect, useState } from "react";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  defaultProfileSectionForStep,
  MIN_PORTFOLIO_IMAGES,
  profileSectionFromParam,
  profileSectionHref,
} from "./constants";
import { portfolioApprovalBlockedCopy } from "./onboardingCopy";
import { OnboardingStepContent } from "./OnboardingStepContent";
import { draftSavedLabel } from "./draftSavedLabel";
import { WizardAside } from "./ui/WizardAside";
import { WizardFrame } from "./ui/WizardFrame";
import { OnboardingStepInfoModal } from "./ui/OnboardingStepInfoModal";
import { VendorProfilePhotoField } from "./VendorProfilePhotoField";
import { VendorProfileSectionTabs } from "./VendorProfileSectionTabs";
import { VendorProfileEditorView } from "@/features/vendor/profile/VendorProfileEditorView";
import { useVendorOnboardingController } from "./useVendorOnboardingController";
import { vendorIsLiveApproved } from "@/lib/vendorAccess";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Modal } from "@/components/ui/Modal";

export function VendorOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWalkthrough = searchParams.get("walkthrough") === "1";
  const { signOut, user } = useAuth();
  const {
    step,
    data,
    businessNameError,
    phoneError,
    formError,
    formErrorAlertKey,
    setFormError,
    loadStatus,
    saving,
    approvalStatus,
    listingVisible,
    payoutsVerified,
    refreshingStatus,
    statusCheckFeedback,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    portfolioImageCount,
    canAddPortfolioWhilePending,
    returnedForEdits,
    primaryLabel,
    profileStatus,
    lastSavedAt,
    setBusinessNameError,
    setPhoneError,
    onGenerateBioWithAI,
    generatingBio,
    onViewProfileReview,
    onAddPortfolioPhotos,
    onRefreshStatus,
    goNext,
    goBack,
    goBackToReview,
    returnToReview,
    navigateToStep,
    update,
    authLoading,
    portfolioQuality,
    portfolioQualityAccepted,
    removePortfolioFileAtIndex,
    acceptPortfolioQualityAnyway,
    onRemovePersistedPortfolioImage,
    uploadingVideo,
    videoUploadError,
    onUploadPortfolioVideo,
    onRemovePortfolioVideo,
    uploadingDoc,
    onUploadAdditionalDoc,
    onRemoveAdditionalDoc,
    onRemoveOtherDoc,
    uploadingProfileImage,
    profileImageError,
    onUploadProfileImage,
  } = useVendorOnboardingController({ isWalkthrough });

  const isApprovedLive = vendorIsLiveApproved({
    onboarding_status: profileStatus,
    approval_status: approvalStatus,
  });
  const useWizardLayout = isWalkthrough || !isApprovedLive;

  const isLiveEdit = !useWizardLayout;
  /** Jumped from review to fix one section — "Back to review" replaces linear Back. */
  const editingFromReview = returnToReview && step < ONBOARDING_STEP.review;
  const showWizardBack =
    !editingFromReview &&
    (step > 1 || (lockedPendingReview && (step === ONBOARDING_STEP.portfolio || step === ONBOARDING_STEP.review)));
  const returnedForEditsPending = !isWalkthrough && returnedForEdits;
  const [stepInfoOpen, setStepInfoOpen] = useState(false);

  // Live editor: the URL (`?section=<slug>`) is the source of truth for the open section,
  // so a link from anywhere (e.g. the dashboard's refund-policy prompt) opens it directly.
  const sectionFromUrl = profileSectionFromParam(searchParams.get("section"));
  const sectionStepFromUrl = sectionFromUrl?.step;
  useEffect(() => {
    if (!isLiveEdit || loadStatus !== "ready" || sectionStepFromUrl === undefined) return;
    navigateToStep(sectionStepFromUrl);
  }, [isLiveEdit, loadStatus, sectionStepFromUrl, navigateToStep]);
  const activeSection =
    sectionFromUrl && sectionFromUrl.step === step ? sectionFromUrl.slug : defaultProfileSectionForStep(step);
  /** In the live editor, in-page jumps (Review's "Edit" links) go through the URL too. */
  const goToStep = isLiveEdit
    ? (target: number) => router.push(profileSectionHref(defaultProfileSectionForStep(target)), { scroll: false })
    : navigateToStep;

  useEffect(() => {
    if (step > ONBOARDING_STEP.review) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const portfolioBlockedCopy =
    canAddPortfolioWhilePending ? portfolioApprovalBlockedCopy(portfolioImageCount) : null;

  const stepContentProps = {
    step,
    data,
    update,
    businessNameError,
    setBusinessNameError,
    phoneError,
    setPhoneError,
    onGenerateBioWithAI,
    generatingBio,
    onNavigateToStep: goToStep,
    approvalStatus,
    listingVisible,
    payoutsVerified,
    onViewProfileReview,
    onRefreshStatus: () => void onRefreshStatus(),
    profileStatus,
    refreshingStatus,
    statusCheckFeedback,
    submittedSummaryBusinessName: data.businessName,
    portfolioPhotoCount: portfolioImageCount,
    needsMorePortfolioPhotos: canAddPortfolioWhilePending,
    returnedForEdits: returnedForEditsPending,
    onAddPortfolioPhotos,
    portfolioQuality,
    portfolioQualityAccepted,
    onRemovePortfolioFile: removePortfolioFileAtIndex,
    onAcceptPortfolioQualityAnyway: acceptPortfolioQualityAnyway,
    onRemovePersistedPortfolioImage,
    uploadingVideo,
    videoUploadError,
    onUploadPortfolioVideo,
    onRemovePortfolioVideo,
    uploadingDoc,
    onUploadAdditionalDoc,
    onRemoveAdditionalDoc,
    onRemoveOtherDoc,
    uploadingProfileImage,
    profileImageError,
    onUploadProfileImage,
    isLiveEdit,
    lockedPendingReview,
    onOpenStepInfo: () => setStepInfoOpen(true),
  };

  if (authLoading || loadStatus === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl py-16">
        <LoadingState label="Loading your vendor profile…" variant="centered" />
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className={`mx-auto w-full max-w-3xl ${portalCard} p-5 text-center text-sm text-red-800 ring-red-200/50`}>
        We couldn&apos;t load your saved profile. Refresh the page or try again in a few minutes.
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl bg-amber-50 p-6 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/50">
        <p className="font-heading text-lg font-semibold text-amber-950">
          We couldn&apos;t open your vendor profile
        </p>
        <p className="leading-relaxed text-amber-900/95">{accessDeniedMessage}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await signOut();
                router.push("/login");
              })();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            Sign out and try again
          </button>
          <Link
            href="/register?type=vendor"
            className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100/80"
          >
            Create a vendor account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            I&apos;m a client - sign in instead
          </Link>
        </div>
      </div>
    );
  }

  const reviewsActive = pathname.startsWith("/vendor/profile/reviews");
  const profilePhotoProps = {
    firstName: data.firstName,
    lastName: data.lastName,
    profileImageUrl: data.profileImageUrl,
    editable: true as const,
    uploading: uploadingProfileImage,
    error: profileImageError,
    onUpload: onUploadProfileImage,
  };

  return (
    <div
      className={`w-full ${isLiveEdit ? "text-neutral-900 max-w-6xl" : ""}`}
    >
      {isWalkthrough && (
        <div className="mb-6 rounded-2xl bg-primary/5 p-4 text-sm text-neutral-800 shadow-sm ring-1 ring-primary/15">
          <strong className="font-semibold text-neutral-900">Preview mode</strong>
          {" - "}
          Changes save, but your profile won&apos;t be resubmitted.{" "}
          <Link
            href="/vendor/settings"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Back to Settings
          </Link>
        </div>
      )}
      {lockedPendingReview && step !== ONBOARDING_STEP.submitted && (
        <div className="mb-8 rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/50">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <LottieIllustration asset="pendingReview" size="status" className="shrink-0" />
            <div className="min-w-0">
              <strong className="font-semibold">
                {approvalStatus === "banned"
                  ? "Your profile isn’t visible to clients right now."
                  : portfolioBlockedCopy
                    ? portfolioBlockedCopy.bannerTitle
                    : "Thanks - we’re reviewing your profile."}
              </strong>{" "}
              {approvalStatus === "banned"
                ? "An admin has restricted this profile. You can’t edit it until that changes."
                : portfolioBlockedCopy
                  ? portfolioBlockedCopy.bannerBody
                  : "You can edit again after our review."}
            </div>
          </div>
        </div>
      )}
      <Modal
        key={formErrorAlertKey}
        isOpen={!!formError}
        onClose={() => setFormError(null)}
        title="Almost there"
        zIndexClassName="z-[70]"
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setFormError(null)}>
              OK
            </Button>
          </div>
        }
      >
        {formError ? (
          <p className="whitespace-pre-line text-sm text-neutral-700">{formError}</p>
        ) : null}
      </Modal>

      <OnboardingStepInfoModal
        step={step}
        servicesOffered={data.servicesOffered}
        isOpen={stepInfoOpen}
        onClose={() => setStepInfoOpen(false)}
      />

      {isLiveEdit ? (
        <VendorProfileEditorView
          data={data}
          update={update}
          listingVisible={listingVisible}
          saving={saving}
          onSave={() => void goNext()}
          vendorUserId={user?.id ?? ""}
          activeSectionSlug={sectionFromUrl?.slug ?? null}
          sectionEditor={
            sectionFromUrl ? (
              <div key={activeSection} className="animate-onboarding-panel">
                <OnboardingStepContent {...stepContentProps} />
              </div>
            ) : null
          }
        />
      ) : (
        <div>
          {step <= ONBOARDING_STEP.review &&
          !(returnedForEditsPending && step === ONBOARDING_STEP.review) ? (
            <WizardFrame
              step={step}
              draftSavedLabel={draftSavedLabel(lastSavedAt)}
              aside={<WizardAside step={step} data={data} />}
              footer={{
                showBack: showWizardBack,
                backLabel: lockedPendingReview && (step === ONBOARDING_STEP.portfolio || step === ONBOARDING_STEP.review) ? "Back to status" : "Back",
                onBack: goBack,
                showBackToReview: editingFromReview && !(lockedPendingReview && step === ONBOARDING_STEP.portfolio),
                onBackToReview: goBackToReview,
                hidePrimary: lockedPendingReview && step === ONBOARDING_STEP.review,
                saving,
                primaryLabel,
                onPrimary: () => void goNext(),
                note:
                  lockedPendingReview && step === ONBOARDING_STEP.portfolio && canAddPortfolioWhilePending
                    ? `Please save once you've added at least ${MIN_PORTFOLIO_IMAGES} portfolio photos.`
                    : lockedPendingReview && step === ONBOARDING_STEP.review
                      ? "You can update your profile photo here. Other details stay locked until review finishes."
                      : null,
              }}
            >
              <div key={step} className="animate-onboarding-panel">
                <OnboardingStepContent {...stepContentProps} />
              </div>
            </WizardFrame>
          ) : (
            <OnboardingStepContent {...stepContentProps} />
          )}
        </div>
      )}
    </div>
  );
}
