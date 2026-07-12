"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { STEP_LABELS } from "./constants";
import { OnboardingStepContent } from "./OnboardingStepContent";
import { OnboardingProgressHeader } from "./OnboardingProgressHeader";
import { useVendorOnboardingController } from "./useVendorOnboardingController";
import { LoadingState } from "@/components/ui/LoadingState";

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
    formError,
    loadStatus,
    saving,
    approvalStatus,
    refreshingStatus,
    accessDenied,
    accessDeniedMessage,
    lockedPendingReview,
    primaryLabel,
    profileStatus,
    setBusinessNameError,
    onRegenerateBio,
    onGenerateBioWithAI,
    generatingBio,
    onViewProfileReview,
    onRefreshStatus,
    goNext,
    goBack,
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
    stripeStatus,
    connectingStripe,
    stripeConnectError,
    onConnectStripe,
  } = useVendorOnboardingController({ isWalkthrough });

  const isApprovedLive =
    profileStatus === "submitted" && approvalStatus === "approved";
  const useWizardLayout = isWalkthrough || !isApprovedLive;

  const stepContentProps = {
    step,
    data,
    update,
    businessNameError,
    setBusinessNameError,
    onRegenerateBio,
    onGenerateBioWithAI,
    generatingBio,
    onNavigateToStep: navigateToStep,
    approvalStatus,
    onViewProfileReview,
    onRefreshStatus: () => void onRefreshStatus(),
    refreshingStatus,
    submittedSummaryBusinessName: data.businessName,
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
    stripeStatus,
    connectingStripe,
    stripeConnectError,
    onConnectStripe,
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
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 text-center text-sm text-red-800 shadow-sm ring-1 ring-red-200/50">
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
            I&apos;m a client — sign in instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl text-neutral-900">
      {isWalkthrough && (
        <div className="mb-6 rounded-2xl bg-primary/5 p-4 text-sm text-neutral-800 shadow-sm ring-1 ring-primary/15">
          <strong className="font-semibold text-neutral-900">Walkthrough mode</strong>
          {" — "}
          Step through onboarding to test the flow. Changes still save; finishing won&apos;t
          re-submit an already-approved profile.{" "}
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
          <strong className="font-semibold">
            {approvalStatus === "banned"
              ? "Your profile isn’t visible to clients right now."
              : "Thanks — we’re reviewing your profile."}
          </strong>{" "}
          {approvalStatus === "banned"
            ? "An admin has restricted this profile. You can’t edit it until that changes."
            : "Editing is paused while our team checks your details. Tap “Check approval status” anytime to see if you’re live."}
        </div>
      )}
      {formError && (
        <div className="mb-8 rounded-2xl bg-red-50 p-4 text-sm text-red-800 shadow-sm ring-1 ring-red-200/50">
          {formError}
        </div>
      )}

      {!useWizardLayout ? (
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <aside className="w-full shrink-0 md:w-56">
            <nav className="flex space-x-2 overflow-x-auto pb-2 md:flex-col md:space-x-0 md:space-y-1 md:pb-0">
              {STEP_LABELS.slice(0, 8).map((label, i) => {
                const n = i + 1;
                const active = n === step;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => navigateToStep(n)}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <div className="my-1 hidden border-t border-neutral-100 md:block" />
              <Link
                href="/vendor/profile/reviews"
                className={`block whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  pathname.startsWith("/vendor/profile/reviews")
                    ? "bg-primary/10 text-primary"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                Client reviews
              </Link>
              <div className="my-1 hidden border-t border-neutral-100 md:block" />
              <button
                type="button"
                onClick={() => navigateToStep(9)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  step === 9
                    ? "bg-primary/10 text-primary"
                    : "text-primary/80 hover:bg-neutral-100 hover:text-primary"
                }`}
              >
                ← Back to review
              </button>
            </nav>
          </aside>
          <div className="min-w-0 flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 sm:p-8">
            <div key={step}>
              <OnboardingStepContent {...stepContentProps} />
            </div>
            <div className="mt-10 flex items-center justify-end gap-3 border-t border-neutral-100 pt-8">
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={saving}
                className="min-h-11 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          {step <= 9 && (
            <div className="mb-6 flex items-start gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-600 shadow-sm ring-1 ring-neutral-200/50 transition hover:bg-neutral-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <OnboardingProgressHeader step={step} saving={saving} />
              </div>
            </div>
          )}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 sm:p-8">
            <div key={step}>
              <OnboardingStepContent {...stepContentProps} />
            </div>

            {step <= 9 && (
              <div className="mt-10 border-t border-neutral-100 pt-8">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:justify-start">
                    {step > 1 && step < 10 && (
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 sm:hidden"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </button>
                    )}
                    <p className="text-center text-xs text-neutral-500 sm:text-left">
                      Close anytime — your answers stay saved on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void goNext()}
                    disabled={saving}
                    className="min-h-11 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60 sm:w-auto"
                  >
                    {saving ? "Saving…" : primaryLabel}
                  </button>
                </div>
              </div>
            )}

            {step === 10 && (
              <div className="mt-10 flex justify-center border-t border-neutral-100 pt-8">
                <Link
                  href="/vendor/dashboard"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 sm:w-auto sm:min-w-[12rem]"
                >
                  OK — back to dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
