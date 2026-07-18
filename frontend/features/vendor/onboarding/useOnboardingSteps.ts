"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorDetail, saveVendorProfile } from "@/lib/vendorProfileApi";
import { isHttpStatus } from "@/lib/api-errors";
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
    setFormError,
    applyVendorProfileResponse,
    persistAdditionalInfoFiles,
  } = persistence;

  const { preparePortfolioFilesForSave, validatePortfolioQualityForNext } = media;

  useEffect(() => {
    if (loadStatus !== "ready") return;
    if (lockedPendingReview && step !== 9) {
      setStep(9);
    }
  }, [loadStatus, lockedPendingReview, step, setStep]);

  const primaryLabel = useMemo(() => {
    if (isWalkthrough && step === 8) return "Finish walkthrough";
    if (profileStatus === "submitted" && approvalStatus === "approved") {
      return "Save changes";
    }
    if (step === 8) return "Confirm";
    if (step === 9) return "OK";
    return "Next";
  }, [step, profileStatus, approvalStatus, isWalkthrough]);

  const onViewProfileReview = useCallback(() => {
    if (lockedPendingReview) return;
    setFormError(null);
    setStep(8);
  }, [lockedPendingReview, setFormError, setStep]);

  const goNext = useCallback(async () => {
    if (step === 9 || saving || loadStatus !== "ready" || authLoading) return;
    if (lockedPendingReview) return;
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
    const nextStep = step === 8 ? (isLive && !isWalkthrough ? 8 : 9) : step + 1;
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
      if (walkthroughFinish) {
        showToast({ title: "Walkthrough complete", tone: "success" });
        router.push("/vendor/settings");
        return;
      }
      if (isLive && !isWalkthrough) {
        showToast({ title: "Changes saved", tone: "success" });
      } else {
        setStep(nextStep);
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
    profileStatus,
    approvalStatus,
    businessNameError,
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
    if (lockedPendingReview) return;
    if (step <= 1 || step === 9) return;
    setStep((s) => s - 1);
  }, [lockedPendingReview, step, setFormError, setStep]);

  const navigateToStep = useCallback(
    (target: number) => {
      if (lockedPendingReview) return;
      if (target < 1 || target > 8) return;
      setFormError(null);
      setStep(target);
    },
    [lockedPendingReview, setFormError, setStep],
  );

  return {
    businessNameError,
    setBusinessNameError,
    primaryLabel,
    onViewProfileReview,
    goNext,
    goBack,
    navigateToStep,
  };
}
