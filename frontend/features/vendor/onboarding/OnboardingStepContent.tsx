"use client";

import type { VendorOnboardingData, VendorOnboardingUpdate } from "./types";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import type { PortfolioImageQualityRow } from "./useVendorOnboardingController";
import {
  StepAccount,
  StepAdditionalInfo,
  StepAvailability,
  StepBusiness,
  StepLocation,
  StepPortfolio,
  StepPricing,
  StepReview,
  StepSubmitted,
} from "./steps";

type Props = {
  step: number;
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  businessNameError: string | null;
  setBusinessNameError: (v: string | null) => void;
  onRegenerateBio: () => void;
  onGenerateBioWithAI: () => void | Promise<void>;
  generatingBio?: boolean;
  onNavigateToStep: (step: number) => void;
  approvalStatus: VendorApprovalStatus;
  onViewProfileReview: () => void;
  onRefreshStatus: () => void;
  refreshingStatus?: boolean;
  submittedSummaryBusinessName?: string;
  portfolioQuality: Record<string, PortfolioImageQualityRow>;
  portfolioQualityAccepted: Record<string, boolean>;
  onRemovePortfolioFile: (index: number) => void;
  onAcceptPortfolioQualityAnyway: (fileKey: string) => void;
  onRemovePersistedPortfolioImage: (url: string) => void;
  uploadingVideo?: boolean;
  videoUploadError?: string | null;
  onUploadPortfolioVideo: (file: File) => void | Promise<void>;
  onRemovePortfolioVideo: () => void;
  uploadingDoc: Record<"foodHygiene" | "indemnity" | "other", boolean>;
  onUploadAdditionalDoc: (
    kind: "foodHygiene" | "indemnity" | "other",
    file: File,
  ) => void | Promise<void>;
  onRemoveAdditionalDoc: (kind: "foodHygiene" | "indemnity") => void;
  onRemoveOtherDoc: (url: string) => void;
  uploadingProfileImage?: boolean;
  profileImageError?: string | null;
  onUploadProfileImage: (file: File) => void | Promise<void>;
};

/** Routes the current step to the matching screen under `steps/`. */
export function OnboardingStepContent({
  step,
  data,
  update,
  businessNameError,
  setBusinessNameError,
  onRegenerateBio,
  onGenerateBioWithAI,
  generatingBio,
  onNavigateToStep,
  approvalStatus,
  onViewProfileReview,
  onRefreshStatus,
  refreshingStatus,
  submittedSummaryBusinessName,
  portfolioQuality,
  portfolioQualityAccepted,
  onRemovePortfolioFile,
  onAcceptPortfolioQualityAnyway,
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
}: Props) {
  switch (step) {
    case 1:
      return <StepAccount data={data} update={update} />;
    case 2:
      return (
        <StepBusiness
          data={data}
          update={update}
          businessNameError={businessNameError}
          setBusinessNameError={setBusinessNameError}
        />
      );
    case 3:
      return <StepLocation data={data} update={update} />;
    case 4:
      return <StepPricing data={data} update={update} />;
    case 5:
      return <StepAvailability data={data} update={update} />;
    case 6:
      return (
        <StepPortfolio
          data={data}
          update={update}
          portfolioQuality={portfolioQuality}
          portfolioQualityAccepted={portfolioQualityAccepted}
          onRemovePortfolioFile={onRemovePortfolioFile}
          onAcceptPortfolioQualityAnyway={onAcceptPortfolioQualityAnyway}
          onRemovePersistedPortfolioImage={onRemovePersistedPortfolioImage}
          uploadingVideo={uploadingVideo}
          videoUploadError={videoUploadError}
          onUploadPortfolioVideo={onUploadPortfolioVideo}
          onRemovePortfolioVideo={onRemovePortfolioVideo}
        />
      );
    case 7:
      return (
        <StepAdditionalInfo
          data={data}
          update={update}
          uploadingDoc={uploadingDoc}
          onUploadAdditionalDoc={onUploadAdditionalDoc}
          onRemoveAdditionalDoc={onRemoveAdditionalDoc}
          onRemoveOtherDoc={onRemoveOtherDoc}
        />
      );
    case 8:
      return (
        <StepReview
          data={data}
          update={update}
          onRegenerateBio={onRegenerateBio}
          onGenerateBioWithAI={onGenerateBioWithAI}
          generatingBio={generatingBio}
          onNavigateToStep={onNavigateToStep}
          uploadingProfileImage={uploadingProfileImage}
          profileImageError={profileImageError}
          onUploadProfileImage={onUploadProfileImage}
        />
      );
    case 9:
      return (
        <StepSubmitted
          approvalStatus={approvalStatus}
          onViewProfileReview={onViewProfileReview}
          onRefreshStatus={onRefreshStatus}
          refreshing={refreshingStatus}
          businessName={submittedSummaryBusinessName}
        />
      );
    default:
      return null;
  }
}
