"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorDetail, saveVendorProfile } from "@/lib/vendorProfileApi";
import { UploadSessionExpiredError, isHttpStatus, mediaUploadErrorMessage } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { vendorIsLiveApproved } from "@/lib/vendorAccess";
import type { useToast } from "@/components/ui/Toast";
import { buildDraftBio, validateStep } from "./onboardingLogic";
import { defaultProfileSectionForStep, profileSectionHref } from "../../../lib/vendorOnboarding/constants";
import { ONBOARDING_STEP } from "../../../lib/vendorOnboarding/onboardingProgress";
import { vendorDataToPayload } from "./serializeVendorPayload";
import type { VendorOnboardingData } from "../../../lib/vendorOnboarding/types";
import type { useOnboardingPersistence } from "./useOnboardingPersistence";
import type { useOnboardingMedia } from "./useOnboardingMedia";

type PersistenceSlice = Pick<
  ReturnType<typeof useOnboardingPersistence>,
  | "data"
  | "setData"
  | "bioVariant"
  | "loadStatus"
  | "saving"
  | "setSaving"
  | "profileStatus"
  | "approvalStatus"
  | "lockedPendingReview"
  | "canAddPortfolioWhilePending"
  | "formError"
  | "setFormError"
  | "applyVendorProfileResponse"
  | "persistAdditionalInfoFiles"
>;

type MediaSlice = Pick<
  ReturnType<typeof useOnboardingMedia>,
  "preparePortfolioFilesForSave" | "validatePortfolioQualityForNext"
>;

type UseOnboardingStepsOptions = {
  isWalkthrough: boolean;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  authLoading: boolean;
  persistence: PersistenceSlice;
  media: MediaSlice;
  showToast: ReturnType<typeof useToast>["showToast"];
};

export function useOnboardingSteps({
  isWalkthrough,
  step,
  setStep,
  authLoading,
  persistence,
  media,
  showToast,
}: UseOnboardingStepsOptions) {
  const router = useRouter();
  const [businessNameError, setBusinessNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);

  const {
    data,
    setData,
    bioVariant,
    loadStatus,
    saving,
    setSaving,
    profileStatus,
    approvalStatus,
    lockedPendingReview,
    canAddPortfolioWhilePending,
    setFormError,
    applyVendorProfileResponse,
    persistAdditionalInfoFiles,
  } = persistence;

  const { preparePortfolioFilesForSave, validatePortfolioQualityForNext } = media;

  useEffect(() => {
    if (loadStatus !== "ready") return;
    // Pending review owns step 9. Check this first so a leftover returned-for-edits
    // flag cannot bounce the wizard 8 ↔ 9 after submit.
    if (lockedPendingReview && step !== ONBOARDING_STEP.submitted && !(step === ONBOARDING_STEP.portfolio && canAddPortfolioWhilePending)) {
      setStep(ONBOARDING_STEP.submitted);
      return;
    }
    if (!isWalkthrough && step === ONBOARDING_STEP.submitted && profileStatus === "draft") {
      setStep(ONBOARDING_STEP.review);
      setReturnToReview(false);
    }
  }, [
    loadStatus,
    lockedPendingReview,
    canAddPortfolioWhilePending,
    step,
    setStep,
    profileStatus,
    isWalkthrough,
  ]);

  const primaryLabel = useMemo(() => {
    if (canAddPortfolioWhilePending && step === ONBOARDING_STEP.portfolio) return "Save photos";
    if (isWalkthrough && step === ONBOARDING_STEP.review) return "Finish walkthrough";
    if (vendorIsLiveApproved({ onboarding_status: profileStatus, approval_status: approvalStatus })) {
      return "Save changes";
    }
    if (step === ONBOARDING_STEP.review) return "Submit for review";
    if (step === ONBOARDING_STEP.submitted) return "OK";
    return "Save and continue";
  }, [step, profileStatus, approvalStatus, isWalkthrough, canAddPortfolioWhilePending]);

  const onAddPortfolioPhotos = useCallback(() => {
    if (!canAddPortfolioWhilePending) return;
    setFormError(null);
    setStep(ONBOARDING_STEP.portfolio);
  }, [canAddPortfolioWhilePending, setFormError, setStep]);

  const onViewProfileReview = useCallback(() => {
    setFormError(null);
    setStep(ONBOARDING_STEP.review);
  }, [setFormError, setStep]);

  const goNext = useCallback(async () => {
    if (step === ONBOARDING_STEP.submitted || saving || loadStatus !== "ready" || authLoading) return;
    if (lockedPendingReview && !(step === ONBOARDING_STEP.portfolio && canAddPortfolioWhilePending)) return;
    if (phoneError && step === 1) {
      setFormError("Fix your phone number before continuing.");
      return;
    }
    if (businessNameError && step === 2) {
      setFormError("Fix business name before continuing.");
      return;
    }
    const workingData: VendorOnboardingData =
      step === 2
        ? {
            ...data,
            aiBioDraft: data.aiBioDraft.trim() ? data.aiBioDraft : buildDraftBio(data, bioVariant),
          }
        : data;
    const err = validateStep(step, workingData);
    if (err) {
      setFormError(err);
      return;
    }
    if (step === 2) {
      setData(workingData);
    }

    if (step === ONBOARDING_STEP.portfolio) {
      const qualityErr = validatePortfolioQualityForNext(workingData);
      if (qualityErr) {
        setFormError(qualityErr);
        return;
      }
    }

    const isLive = vendorIsLiveApproved({
      onboarding_status: profileStatus,
      approval_status: approvalStatus,
    });
    const walkthroughFinish = isWalkthrough && step === ONBOARDING_STEP.review && isLive;
    const portfolioFixSave = canAddPortfolioWhilePending && step === ONBOARDING_STEP.portfolio;
    const nextStep = portfolioFixSave
      ? ONBOARDING_STEP.submitted
      : step === ONBOARDING_STEP.review
        ? isLive && !isWalkthrough
          ? ONBOARDING_STEP.review
          : ONBOARDING_STEP.submitted
        : step + 1;
    setSaving(true);
    setFormError(null);
    try {
      let dataToSave: VendorOnboardingData = workingData;
      if (step === ONBOARDING_STEP.portfolio) {
        try {
          dataToSave = await preparePortfolioFilesForSave(workingData);
          setData(dataToSave);
        } catch (e) {
          setFormError(
            e instanceof UploadSessionExpiredError
              ? e.message
              : mediaUploadErrorMessage(e, "photo"),
          );
          return;
        }
      }
      if (step === ONBOARDING_STEP.additionalInfo) {
        try {
          dataToSave = await persistAdditionalInfoFiles(dataToSave);
          setData(dataToSave);
        } catch (e) {
          setFormError(mediaUploadErrorMessage(e, "document"));
          return;
        }
      }
      const res = await saveVendorProfile({
        current_step: walkthroughFinish ? ONBOARDING_STEP.review : nextStep,
        profile_form_data: vendorDataToPayload(dataToSave),
        onboarding_status: step === ONBOARDING_STEP.review && !walkthroughFinish ? "submitted" : undefined,
      });
      applyVendorProfileResponse(res);
      if (portfolioFixSave) {
        showToast({ title: "Portfolio photos saved", tone: "success" });
        setStep(ONBOARDING_STEP.submitted);
        return;
      }
      if (walkthroughFinish) {
        showToast({ title: "Walkthrough complete", tone: "success" });
        router.push("/vendor/settings");
        return;
      }
      if (isLive && !isWalkthrough) {
        track(MixpanelEvents.vendor_profile_saved, { step });
        showToast({ title: "Changes saved", tone: "success" });
        const nextHref =
          step >= ONBOARDING_STEP.review
            ? "/vendor/profile"
            : profileSectionHref(defaultProfileSectionForStep(step + 1));
        router.push(nextHref);
        return;
      }
      if (step === ONBOARDING_STEP.review && !walkthroughFinish) {
        track(MixpanelEvents.vendor_onboarding_submitted);
        showToast({ title: "Submitted for review", tone: "success" });
      }
      setStep(nextStep);
      if (nextStep === ONBOARDING_STEP.review) {
        setReturnToReview(false);
      }
    } catch (e) {
      const detail =
        getApiErrorDetail(e) ??
        "We couldn't save your changes. Check your connection and try again.";
      if (isHttpStatus(e, 409)) {
        setBusinessNameError(detail);
        if (step !== 2) {
          setFormError(`${detail} Go back to Business to choose another name.`);
        } else {
          setFormError(detail);
        }
      } else {
        setFormError(detail);
      }
    } finally {
      setSaving(false);
    }
  }, [
    step,
    saving,
    loadStatus,
    authLoading,
    lockedPendingReview,
    canAddPortfolioWhilePending,
    profileStatus,
    approvalStatus,
    businessNameError,
    phoneError,
    data,
    bioVariant,
    applyVendorProfileResponse,
    persistAdditionalInfoFiles,
    router,
    isWalkthrough,
    showToast,
    setData,
    setFormError,
    setSaving,
    setStep,
    preparePortfolioFilesForSave,
    validatePortfolioQualityForNext,
  ]);

  const goBack = useCallback(() => {
    setFormError(null);
    if (lockedPendingReview) {
      if (canAddPortfolioWhilePending && step === ONBOARDING_STEP.portfolio) {
        setStep(ONBOARDING_STEP.submitted);
        return;
      }
      if (step === ONBOARDING_STEP.review) {
        setStep(ONBOARDING_STEP.submitted);
        return;
      }
      return;
    }
    if (step <= 1 || step === ONBOARDING_STEP.submitted) return;
    setStep((s) => s - 1);
  }, [lockedPendingReview, canAddPortfolioWhilePending, step, setFormError, setStep]);

  const goBackToReview = useCallback(() => {
    setFormError(null);
    setReturnToReview(false);
    setStep(ONBOARDING_STEP.review);
  }, [setFormError, setStep]);

  const navigateToStep = useCallback(
    (target: number) => {
    if (lockedPendingReview) {
      if (target === ONBOARDING_STEP.review) {
        setFormError(null);
        setStep(ONBOARDING_STEP.review);
        return;
      }
      if (target !== ONBOARDING_STEP.portfolio || !canAddPortfolioWhilePending) return;
        setFormError(null);
        setStep(ONBOARDING_STEP.portfolio);
        return;
      }
      if (target < 1 || target > ONBOARDING_STEP.review) return;
      setFormError(null);
      if (target >= 1 && target < ONBOARDING_STEP.review) {
        setReturnToReview(true);
      }
      if (target === ONBOARDING_STEP.review) {
        setReturnToReview(false);
      }
      setStep(target);
    },
    [lockedPendingReview, canAddPortfolioWhilePending, setFormError, setStep],
  );

  return {
    businessNameError,
    setBusinessNameError,
    phoneError,
    setPhoneError,
    primaryLabel,
    onViewProfileReview,
    onAddPortfolioPhotos,
    goNext,
    goBack,
    goBackToReview,
    returnToReview,
    navigateToStep,
  };
}
