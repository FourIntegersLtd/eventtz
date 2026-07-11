"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  STEP_LABELS,
} from "./constants";
import { OnboardingStepContent } from "./OnboardingStepContent";
import { useVendorOnboardingController } from "./useVendorOnboardingController";

export function VendorOnboarding() {
  const router = useRouter();
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
  } = useVendorOnboardingController();

  if (authLoading || loadStatus === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl py-16 text-center text-sm text-neutral-600">
        Loading your vendor profile…
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

      {profileStatus === "submitted" && approvalStatus === "approved" ? (
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
            <OnboardingStepContent
              step={step}
              data={data}
              update={update}
              businessNameError={businessNameError}
              setBusinessNameError={setBusinessNameError}
              onRegenerateBio={onRegenerateBio}
              onGenerateBioWithAI={onGenerateBioWithAI}
              generatingBio={generatingBio}
              onNavigateToStep={navigateToStep}
              approvalStatus={approvalStatus}
              onViewProfileReview={onViewProfileReview}
              onRefreshStatus={() => void onRefreshStatus()}
              refreshingStatus={refreshingStatus}
              submittedSummaryBusinessName={data.businessName}
              portfolioQuality={portfolioQuality}
              portfolioQualityAccepted={portfolioQualityAccepted}
              onRemovePortfolioFile={removePortfolioFileAtIndex}
              onAcceptPortfolioQualityAnyway={acceptPortfolioQualityAnyway}
              onRemovePersistedPortfolioImage={onRemovePersistedPortfolioImage}
              uploadingVideo={uploadingVideo}
              videoUploadError={videoUploadError}
              onUploadPortfolioVideo={onUploadPortfolioVideo}
              onRemovePortfolioVideo={onRemovePortfolioVideo}
              uploadingDoc={uploadingDoc}
              onUploadAdditionalDoc={onUploadAdditionalDoc}
              onRemoveAdditionalDoc={onRemoveAdditionalDoc}
              onRemoveOtherDoc={onRemoveOtherDoc}
              stripeStatus={stripeStatus}
              connectingStripe={connectingStripe}
              stripeConnectError={stripeConnectError}
              onConnectStripe={onConnectStripe}
            />
            <div className="mt-10 flex items-center justify-end gap-3 border-t border-neutral-100 pt-8">
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={saving}
                className="min-w-[140px] rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          {step <= 9 && (
            <div className="mb-8">
              <div className="mb-2 flex justify-between text-xs text-neutral-500">
                <span>
                  Step {step} of {STEP_LABELS.length}
                </span>
                <span className="hidden sm:inline">{STEP_LABELS[step - 1]}</span>
              </div>
              <div className="flex gap-1">
                {STEP_LABELS.map((_, i) => {
                  const n = i + 1;
                  const active = n === step;
                  const done = n < step;
                  return (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full transition ${
                        done || active ? "bg-primary" : "bg-neutral-200"
                      } ${active ? "opacity-100" : done ? "opacity-60" : ""}`}
                      title={STEP_LABELS[i]}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[11px] text-neutral-400 sm:hidden">
                {STEP_LABELS[step - 1]}
              </p>
            </div>
          )}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 sm:p-8">
            <OnboardingStepContent
              step={step}
              data={data}
              update={update}
              businessNameError={businessNameError}
              setBusinessNameError={setBusinessNameError}
              onRegenerateBio={onRegenerateBio}
              onGenerateBioWithAI={onGenerateBioWithAI}
              generatingBio={generatingBio}
              onNavigateToStep={navigateToStep}
              approvalStatus={approvalStatus}
              onViewProfileReview={onViewProfileReview}
              onRefreshStatus={() => void onRefreshStatus()}
              refreshingStatus={refreshingStatus}
              submittedSummaryBusinessName={data.businessName}
              portfolioQuality={portfolioQuality}
              portfolioQualityAccepted={portfolioQualityAccepted}
              onRemovePortfolioFile={removePortfolioFileAtIndex}
              onAcceptPortfolioQualityAnyway={acceptPortfolioQualityAnyway}
              onRemovePersistedPortfolioImage={onRemovePersistedPortfolioImage}
              uploadingVideo={uploadingVideo}
              videoUploadError={videoUploadError}
              onUploadPortfolioVideo={onUploadPortfolioVideo}
              onRemovePortfolioVideo={onRemovePortfolioVideo}
              uploadingDoc={uploadingDoc}
              onUploadAdditionalDoc={onUploadAdditionalDoc}
              onRemoveAdditionalDoc={onRemoveAdditionalDoc}
              onRemoveOtherDoc={onRemoveOtherDoc}
              stripeStatus={stripeStatus}
              connectingStripe={connectingStripe}
              stripeConnectError={stripeConnectError}
              onConnectStripe={onConnectStripe}
            />

            {step <= 9 && (
              <div className="mt-10 flex items-center justify-between gap-3 border-t border-neutral-100 pt-8">
                <div className="flex w-1/3 justify-start">
                  {step > 1 && step < 10 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex items-center gap-1 rounded-xl bg-neutral-50 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </button>
                  )}
                </div>
                <div className="flex w-1/3 justify-center"></div>
                <div className="flex w-1/3 justify-end">
                  <button
                    type="button"
                    onClick={() => void goNext()}
                    disabled={saving}
                    className="min-w-[140px] rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:opacity-60"
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
                  className="inline-flex min-w-[140px] items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90"
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
