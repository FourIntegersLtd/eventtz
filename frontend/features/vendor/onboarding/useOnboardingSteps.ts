"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorDetail, saveVendorProfile } from "@/lib/vendorProfileApi";
import { isHttpStatus } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import type { useToast } from "@/components/ui/Toast";
import { buildDraftBio, validateStep } from "./onboardingLogic";
import { vendorDataToPayload } from "./serializeVendorPayload";
import type { VendorOnboardingData } from "./types";
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
    if (lockedPendingReview && step !== 9 && !(step === 6 && canAddPortfolioWhilePending)) {
      setStep(9);
    }
  }, [loadStatus, lockedPendingReview, canAddPortfolioWhilePending, step, setStep]);

  const primaryLabel = useMemo(() => {
    if (canAddPortfolioWhilePending && step === 6) return "Save photos";
    if (isWalkthrough && step === 8) return "Finish walkthrough";
    if (profileStatus === "submitted" && approvalStatus === "approved") {
      return "Save changes";
    }
    if (step === 8) return "Confirm";
    if (step === 9) return "OK";
    return "Next";
  }, [step, profileStatus, approvalStatus, isWalkthrough, canAddPortfolioWhilePending]);

  const onAddPortfolioPhotos = useCallback(() => {
    if (!canAddPortfolioWhilePending) return;
    setFormError(null);
    setStep(6);
  }, [canAddPortfolioWhilePending, setFormError, setStep]);

  const onViewProfileReview = useCallback(() => {
    if (lockedPendingReview) return;
    setFormError(null);
    setStep(8);
  }, [lockedPendingReview, setFormError, setStep]);

  const goNext = useCallback(async () => {
    if (step === 9 || saving || loadStatus !== "ready" || authLoading) return;
    if (lockedPendingReview && !(step === 6 && canAddPortfolioWhilePending)) return;
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

    if (step === 6) {
      const qualityErr = validatePortfolioQualityForNext(workingData);
      if (qualityErr) {
        setFormError(qualityErr);
        return;
      }
    }

    const isLive = profileStatus === "submitted" && approvalStatus === "approved";
    const walkthroughFinish = isWalkthrough && step === 8 && isLive;
    const portfolioFixSave = canAddPortfolioWhilePending && step === 6;
    const nextStep = portfolioFixSave
      ? 9
      : step === 8
        ? isLive && !isWalkthrough
          ? 8
          : 9
        : step + 1;
    setSaving(true);
    setFormError(null);
    try {
      let dataToSave: VendorOnboardingData = workingData;
      if (step === 6) {
        try {
          dataToSave = await preparePortfolioFilesForSave(workingData);
          setData(dataToSave);
        } catch (e) {
          setFormError(e instanceof Error ? e.message : "Could not upload portfolio images.");
          return;
        }
      }
      if (step === 7) {
        dataToSave = await persistAdditionalInfoFiles(dataToSave);
        setData(dataToSave);
      }
      const res = await saveVendorProfile({
        current_step: walkthroughFinish ? 8 : nextStep,
        payload: vendorDataToPayload(dataToSave),
        status: step === 8 && !walkthroughFinish ? "submitted" : undefined,
      });
      applyVendorProfileResponse(res);
      if (portfolioFixSave) {
        showToast({ title: "Portfolio photos saved", tone: "success" });
        setStep(9);
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
      } else {
        if (step === 8 && !walkthroughFinish) {
          track(MixpanelEvents.vendor_onboarding_submitted);
        }
        setStep(nextStep);
        if (nextStep === 8) {
          setReturnToReview(false);
        }
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
      if (canAddPortfolioWhilePending && step === 6) setStep(9);
      return;
    }
    if (step <= 1 || step === 9) return;
    setStep((s) => s - 1);
  }, [lockedPendingReview, canAddPortfolioWhilePending, step, setFormError, setStep]);

  const goBackToReview = useCallback(() => {
    setFormError(null);
    setReturnToReview(false);
    setStep(8);
  }, [setFormError, setStep]);

  const navigateToStep = useCallback(
    (target: number) => {
      if (lockedPendingReview) {
        if (target !== 6 || !canAddPortfolioWhilePending) return;
        setFormError(null);
        setStep(6);
        return;
      }
      if (target < 1 || target > 8) return;
      setFormError(null);
      if (target >= 1 && target <= 7) {
        setReturnToReview(true);
      }
      if (target === 8) {
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
