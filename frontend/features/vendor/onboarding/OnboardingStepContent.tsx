"use client";

import type { ReactNode } from "react";
import type { VendorOnboardingData, VendorOnboardingUpdate, VendorStatusCheckFeedback } from "./types";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import type { PortfolioImageQualityRow } from "./useVendorOnboardingController";
import { OnboardingWizardStepTitle } from "./ui/OnboardingWizardStepTitle";
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
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
  onGenerateBioWithAI: () => void | Promise<void>;
  generatingBio?: boolean;
  onNavigateToStep: (step: number) => void;
  approvalStatus: VendorApprovalStatus;
  listingVisible?: boolean;
  payoutsVerified?: boolean;
  onViewProfileReview: () => void;
  onRefreshStatus: () => void;
  profileStatus?: string;
  returnedForEdits?: boolean;
  refreshingStatus?: boolean;
  statusCheckFeedback?: VendorStatusCheckFeedback | null;
  submittedSummaryBusinessName?: string;
  portfolioPhotoCount?: number;
  needsMorePortfolioPhotos?: boolean;
  onAddPortfolioPhotos?: () => void;
  portfolioQuality: Record<string, PortfolioImageQualityRow>;
  portfolioQualityAccepted: Record<string, boolean>;
  onRemovePortfolioFile: (index: number) => void;
  onAcceptPortfolioQualityAnyway: (fileKey: string) => void;
  onRemovePersistedPortfolioImage: (url: string) => void;
  uploadingVideo?: boolean;
  videoUploadError?: string | null;
  onUploadPortfolioVideo: (file: File) => void | Promise<void>;
  onRemovePortfolioVideo: (url: string) => void;
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
  /** Post-approval profile editor - Settings-style sectioned cards, not wizard mega-card. */
  isLiveEdit?: boolean;
  lockedPendingReview?: boolean;
  onOpenStepInfo?: () => void;
};

function LiveEditStepShell({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white px-5 py-5 sm:px-6 sm:py-6">
      {children}
    </section>
  );
}

/** Routes the current step to the matching screen under `steps/`. */
export function OnboardingStepContent({
  step,
  data,
  update,
  businessNameError,
  setBusinessNameError,
  phoneError,
  setPhoneError,
  onGenerateBioWithAI,
  generatingBio,
  onNavigateToStep,
  approvalStatus,
  listingVisible,
  payoutsVerified,
  onViewProfileReview,
  onRefreshStatus,
  returnedForEdits = false,
  refreshingStatus,
  statusCheckFeedback,
  submittedSummaryBusinessName,
  portfolioPhotoCount,
  needsMorePortfolioPhotos,
  onAddPortfolioPhotos,
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
  isLiveEdit = false,
  lockedPendingReview = false,
  onOpenStepInfo,
}: Props) {
  const wrapLive = (node: ReactNode) =>
    isLiveEdit ? (
      <LiveEditStepShell>
        {step >= 1 && step <= 8 ? (
          <OnboardingWizardStepTitle
            step={step}
            servicesOffered={data.servicesOffered}
            onOpenStepInfo={onOpenStepInfo}
          />
        ) : null}
        {node}
      </LiveEditStepShell>
    ) : (
      node
    );

  switch (step) {
    case 1:
      return wrapLive(
        <StepAccount
          data={data}
          update={update}
          phoneError={phoneError}
          setPhoneError={setPhoneError}
          showWelcomeHero={!isLiveEdit}
        />,
      );
    case 2:
      return wrapLive(
        <StepBusiness
          data={data}
          update={update}
          businessNameError={businessNameError}
          setBusinessNameError={setBusinessNameError}
        />,
      );
    case 3:
      return wrapLive(<StepLocation data={data} update={update} />);
    case 4:
      return wrapLive(
        <StepPricing
          data={data}
          update={update}
          usePostLaunchOptimizer={isLiveEdit && approvalStatus === "approved"}
        />,
      );
    case 5:
      return wrapLive(<StepAvailability data={data} update={update} />);
    case 6:
      return wrapLive(
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
        />,
      );
    case 7:
      return wrapLive(
        <StepAdditionalInfo
          data={data}
          update={update}
          uploadingDoc={uploadingDoc}
          onUploadAdditionalDoc={onUploadAdditionalDoc}
          onRemoveAdditionalDoc={onRemoveAdditionalDoc}
          onRemoveOtherDoc={onRemoveOtherDoc}
        />,
      );
    case 8:
      return (
        <StepReview
          data={data}
          update={update}
          onGenerateBioWithAI={onGenerateBioWithAI}
          generatingBio={generatingBio}
          onNavigateToStep={onNavigateToStep}
          uploadingProfileImage={uploadingProfileImage}
          profileImageError={profileImageError}
          onUploadProfileImage={onUploadProfileImage}
          isLiveEdit={isLiveEdit}
          readOnly={!isLiveEdit && lockedPendingReview}
          profilePhotoEditable={approvalStatus !== "banned"}
        />
      );
    case 9:
      return (
        <StepSubmitted
          approvalStatus={approvalStatus}
          returnedForEdits={returnedForEdits}
          listingVisible={listingVisible}
          payoutsVerified={payoutsVerified}
          onViewProfileReview={onViewProfileReview}
          onEditProfile={() => onNavigateToStep(8)}
          onRefreshStatus={onRefreshStatus}
          refreshing={refreshingStatus}
          statusCheckFeedback={statusCheckFeedback}
          businessName={submittedSummaryBusinessName}
          firstName={data.firstName}
          lastName={data.lastName}
          profileImageUrl={data.profileImageUrl}
          portfolioPhotoCount={portfolioPhotoCount}
          needsMorePortfolioPhotos={needsMorePortfolioPhotos}
          onAddPortfolioPhotos={onAddPortfolioPhotos}
          uploadingProfileImage={uploadingProfileImage}
          profileImageError={profileImageError}
          onUploadProfileImage={onUploadProfileImage}
          profilePhotoEditable={approvalStatus !== "banned"}
        />
      );
    default:
      return null;
  }
}
