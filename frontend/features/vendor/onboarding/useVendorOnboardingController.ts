"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { useOnboardingMedia } from "./useOnboardingMedia";
import { useOnboardingPersistence } from "./useOnboardingPersistence";
import { useOnboardingSteps } from "./useOnboardingSteps";

export type { PortfolioImageQualityRow } from "./useOnboardingMedia";

export function useVendorOnboardingController(options?: { isWalkthrough?: boolean }) {
  const isWalkthrough = options?.isWalkthrough ?? false;
  const { showToast } = useToast();
  const { loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);

  const persistence = useOnboardingPersistence({
    isWalkthrough,
    step,
    setStep,
  });

  const media = useOnboardingMedia({
    step,
    data: persistence.data,
    setData: persistence.setData,
    update: persistence.update,
    userId: persistence.userId,
    showToast,
    setFormError: persistence.setFormError,
  });

  const steps = useOnboardingSteps({
    isWalkthrough,
    step,
    setStep,
    authLoading,
    persistence,
    media,
    showToast,
  });

  return {
    step,
    data: persistence.data,
    businessNameError: steps.businessNameError,
    formError: persistence.formError,
    setFormError: persistence.setFormError,
    loadStatus: persistence.loadStatus,
    saving: persistence.saving,
    generatingBio: persistence.generatingBio,
    approvalStatus: persistence.approvalStatus,
    refreshingStatus: persistence.refreshingStatus,
    accessDenied: persistence.accessDenied,
    accessDeniedMessage: persistence.accessDeniedMessage,
    lockedPendingReview: persistence.lockedPendingReview,
    primaryLabel: steps.primaryLabel,
    profileStatus: persistence.profileStatus,
    setBusinessNameError: steps.setBusinessNameError,
    onRegenerateBio: persistence.onRegenerateBio,
    onGenerateBioWithAI: persistence.onGenerateBioWithAI,
    onViewProfileReview: steps.onViewProfileReview,
    onRefreshStatus: persistence.onRefreshStatus,
    goNext: steps.goNext,
    goBack: steps.goBack,
    navigateToStep: steps.navigateToStep,
    update: persistence.update,
    authLoading,
    portfolioQuality: media.portfolioQuality,
    portfolioQualityAccepted: media.portfolioQualityAccepted,
    removePortfolioFileAtIndex: media.removePortfolioFileAtIndex,
    acceptPortfolioQualityAnyway: media.acceptPortfolioQualityAnyway,
    onRemovePersistedPortfolioImage: media.onRemovePersistedPortfolioImage,
    uploadingProfileImage: media.uploadingProfileImage,
    profileImageError: media.profileImageError,
    onUploadProfileImage: media.onUploadProfileImage,
    uploadingVideo: media.uploadingVideo,
    videoUploadError: media.videoUploadError,
    onUploadPortfolioVideo: media.onUploadPortfolioVideo,
    onRemovePortfolioVideo: media.onRemovePortfolioVideo,
    uploadingDoc: media.uploadingDoc,
    onUploadAdditionalDoc: media.onUploadAdditionalDoc,
    onRemoveAdditionalDoc: media.onRemoveAdditionalDoc,
    onRemoveOtherDoc: media.onRemoveOtherDoc,
    isWalkthrough,
  };
}
