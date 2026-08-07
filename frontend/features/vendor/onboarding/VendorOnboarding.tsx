"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { portalCard, portalCardPaddingLg } from "@/components/portal-shell/portalTheme";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MIN_PORTFOLIO_IMAGES, STEP_LABELS } from "./constants";
import { portfolioApprovalBlockedCopy } from "./onboardingCopy";
import { OnboardingStepContent } from "./OnboardingStepContent";
import { OnboardingProgressHeader } from "./OnboardingProgressHeader";
import { OnboardingWizardStepTitle } from "./ui/OnboardingWizardStepTitle";
import { useVendorOnboardingController } from "./useVendorOnboardingController";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Modal } from "@/components/ui/Modal";

export function VendorOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWalkthrough = searchParams.get("walkthrough") === "1";
  const { signOut } = useAuth();
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
    refreshingStatus,
    statusCheckFeedback,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    portfolioImageCount,
    needsMorePortfolioPhotos,
    canAddPortfolioWhilePending,
    primaryLabel,
    profileStatus,
    setBusinessNameError,
    setPhoneError,
    onRegenerateBio,
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

  const isApprovedLive =
    profileStatus === "submitted" && approvalStatus === "approved";
  const useWizardLayout = isWalkthrough || !isApprovedLive;

  const isLiveEdit = !useWizardLayout;
  const questionnaireTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLiveEdit || step > 8) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    questionnaireTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, isLiveEdit]);

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
    onRegenerateBio,
    onGenerateBioWithAI,
    generatingBio,
    onNavigateToStep: navigateToStep,
    approvalStatus,
    onViewProfileReview,
    onRefreshStatus: () => void onRefreshStatus(),
    refreshingStatus,
    statusCheckFeedback,
    submittedSummaryBusinessName: data.businessName,
    portfolioPhotoCount,
    needsMorePortfolioPhotos: canAddPortfolioWhilePending,
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

  return (
    <div
      className={`w-full text-neutral-900 ${isLiveEdit ? "max-w-6xl" : "max-w-5xl"}`}
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
      {lockedPendingReview && (
        <div className="mb-8 rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-200/50">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <LottieIllustration asset="pendingReview" className="h-20 w-20 shrink-0" />
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
              {canAddPortfolioWhilePending && step === 9 && portfolioBlockedCopy ? (
                <div className="mt-4 flex justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={onAddPortfolioPhotos}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    {portfolioBlockedCopy.ctaLabel}
                  </button>
                </div>
              ) : null}
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

      {isLiveEdit ? (
        <div className="space-y-6">
          <header>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900">
              Profile
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Your public listing. Save to publish updates.
            </p>
          </header>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)]">
            <aside className="min-w-0 lg:sticky lg:top-4">
              <nav className="overflow-hidden rounded-2xl border border-neutral-100 bg-white p-2">
                <div className="flex space-x-1 overflow-x-auto md:flex-col md:space-x-0 md:space-y-0.5">
                  {STEP_LABELS.slice(0, 7).map((label, i) => {
                    const n = i + 1;
                    const active = n === step;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => navigateToStep(n)}
                        className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="my-1.5 border-t border-neutral-100" />
                <Link
                  href="/vendor/profile/reviews"
                  className={`block whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    pathname.startsWith("/vendor/profile/reviews")
                      ? "bg-primary/10 text-primary"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  Client reviews
                </Link>
                {step !== 8 ? (
                  <>
                    <div className="my-1.5 border-t border-neutral-100" />
                    <button
                      type="button"
                      onClick={() => navigateToStep(8)}
                      className="w-full whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium text-primary/80 outline-none transition hover:bg-neutral-50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      ← Back to review
                    </button>
                  </>
                ) : null}
              </nav>
            </aside>

            <div className="min-w-0 space-y-6">
              <div key={step} className="animate-onboarding-panel">
                <OnboardingStepContent {...stepContentProps} />
              </div>
              <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-[13px] text-neutral-400">
                    Updates apply to your public profile when you save.
                  </p>
                  <button
                    type="button"
                    onClick={() => void goNext()}
                    disabled={saving}
                    className="min-h-11 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60 sm:w-auto"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div ref={questionnaireTopRef} className="scroll-mt-4" aria-hidden />
          {step <= 8 && (
            <div className="mb-6">
              <OnboardingProgressHeader step={step} />
            </div>
          )}
          <div className={`${portalCard} ${portalCardPaddingLg}`}>
            {step <= 8 ? <OnboardingWizardStepTitle step={step} /> : null}
            <div key={step} className="animate-onboarding-panel">
              <OnboardingStepContent {...stepContentProps} />
            </div>

            {step <= 8 && (
              <div className="mt-10 border-t border-neutral-100 pt-8">
                <p className="mb-4 text-center text-xs text-neutral-500 sm:text-left">
                  {lockedPendingReview && step === 6 && canAddPortfolioWhilePending
                    ? `Please save once you've added at least ${MIN_PORTFOLIO_IMAGES} portfolio photos.`
                    : "Close anytime. Your progress is saved."}
                </p>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  {returnToReview && step < 8 && !(lockedPendingReview && step === 6) ? (
                    <button
                      type="button"
                      onClick={goBackToReview}
                      className="min-h-11 w-full rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 sm:order-first sm:w-auto sm:min-w-[9rem]"
                    >
                      Back to review
                    </button>
                  ) : null}
                  <div className="flex flex-1 items-stretch gap-3">
                    {step > 1 || (lockedPendingReview && step === 6) ? (
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 sm:flex-none sm:min-w-[7.5rem]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {lockedPendingReview && step === 6 && canAddPortfolioWhilePending ? "Back to status" : "Back"}
                      </button>
                    ) : (
                      <span className="hidden min-w-[7.5rem] sm:inline-block" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => void goNext()}
                      disabled={saving}
                      className="min-h-11 flex-1 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60 sm:min-w-[7.5rem] sm:flex-none"
                    >
                      {saving ? "Saving…" : primaryLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
