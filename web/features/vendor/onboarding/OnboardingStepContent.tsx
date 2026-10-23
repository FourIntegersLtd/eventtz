"use client";

import type { ReactNode } from "react";
import type { VendorOnboardingData, VendorOnboardingUpdate, VendorStatusCheckFeedback } from "../../../lib/vendorOnboarding/types";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import type { PortfolioImageQualityRow } from "./useVendorOnboardingController";
import { OnboardingWizardStepTitle } from "./ui/OnboardingWizardStepTitle";
import { ONBOARDING_FORM_STEP_COUNT, ONBOARDING_STEP } from "../../../lib/vendorOnboarding/onboardingProgress";
import {
  CancellationPolicyPicker,
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
import { ReturnedForEditsScreen, openReviewForResubmit } from "./steps/submittedScreens";

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
  return <div className="vendor-setup">{children}</div>;
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
        {step >= 1 && step <= ONBOARDING_FORM_STEP_COUNT ? (
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
        />,
      );
    case 2:
      return wrapLive(
        <StepBusiness
          data={data}
          update={update}
          businessNameError={businessNameError}
          setBusinessNameError={setBusinessNameError}
          onGenerateBioWithAI={isLiveEdit ? onGenerateBioWithAI : undefined}
          generatingBio={generatingBio}
        />,
      );
    case 3:
      return wrapLive(
        <StepLocation
          data={data}
          update={update}
          useOnboardingLayout={!isLiveEdit}
        />,
      );
    case 4:
      return wrapLive(
        <StepPricing
          data={data}
          update={update}
          usePostLaunchOptimizer={isLiveEdit && approvalStatus === "approved"}
          showPackageExamples={isLiveEdit}
          useOnboardingLayout={!isLiveEdit}
        />,
      );
    case 5:
      return wrapLive(<CancellationPolicyPicker data={data} update={update} />);
    case 6:
      return wrapLive(<StepAvailability data={data} update={update} />);
    case 7:
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
          uploadingProfileImage={uploadingProfileImage}
          profileImageError={profileImageError}
          onUploadProfileImage={onUploadProfileImage}
        />,
      );
    case 8:
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
    case 9:
      if (returnedForEdits && !isLiveEdit) {
        const reviewedLabel = data.returnedForEditsAt.trim()
          ? new Intl.DateTimeFormat("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(data.returnedForEditsAt))
          : "recently";
        return (
          <ReturnedForEditsScreen
            reviewedAtLabel={reviewedLabel}
            onResubmit={() => openReviewForResubmit(onNavigateToStep)}
          />
        );
      }
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
    case 10:
      return (
        <StepSubmitted
          approvalStatus={approvalStatus}
          returnedForEdits={returnedForEdits}
          listingVisible={listingVisible}
          payoutsVerified={payoutsVerified}
          onViewProfileReview={onViewProfileReview}
          onEditProfile={() => onNavigateToStep(ONBOARDING_STEP.review)}
          onRefreshStatus={onRefreshStatus}
          refreshing={refreshingStatus}
          statusCheckFeedback={statusCheckFeedback}
          businessName={submittedSummaryBusinessName}
          email={data.email}
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
