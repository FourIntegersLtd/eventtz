/** Profile, upload, and onboarding-AI calls for the vendor wizard. */

import { platformRequest, type components } from "@/foundation/platform-client";
import { getApiErrorDetail, isHttpStatus } from "@/domains/vendor-onboarding/apiErrors";

export { getApiErrorDetail } from "@/domains/vendor-onboarding/apiErrors";

/** The vendor's onboarding form and listing state. */
export type VendorProfileResponse = components["schemas"]["VendorProfileState"];
/** Body of `PUT /vendor/profile`. The wizard still names the field `onboarding_status`. */
export type VendorProfileSaveBody = {
  current_step: number;
  profile_form_data: Record<string, unknown>;
  onboarding_status?: string;
};

/** One package the coach commented on. */
export type PackageCoachPackageFeedback = components["schemas"]["PackageCoachPackageFeedback"];
/** One tip from the package coach. */
export type PackageCoachTip = components["schemas"]["PackageCoachTip"];
/**
 * The package coach's review.
 * `applied_package_ids` is added in the browser after the vendor applies suggestions.
 */
export type PackageCoachResult = components["schemas"]["ReviewVendorPackagesResponse"] & {
  applied_package_ids?: string[];
};
/** Vision check of one portfolio photo. */
export type AnalyzePortfolioImageResult = components["schemas"]["AnalyzePortfolioImageResponse"];
/** Where an uploaded file was stored. */
export type ImageUploadResult = components["schemas"]["ImageUploadResponse"];
/** The post-launch package coach's review. */
export type CopilotReviewPackagesResult = components["schemas"]["CopilotReviewPackagesResponse"];

/**
 * The baseline skips the vision call during onboarding.
 * The route exists; this flag is what the wizard actually checks.
 */
export const SKIP_PORTFOLIO_IMAGE_ANALYSIS = true;

/** Load the signed-in vendor's onboarding form. */
export function fetchVendorProfile(): Promise<VendorProfileResponse> {
  return platformRequest<VendorProfileResponse>("/api/v1/vendor/profile");
}

/** True when the profile route refuses this account. */
export function isVendorProfileForbiddenError(error: unknown): boolean {
  return isHttpStatus(error, 403);
}

/** Save the form. `onboarding_status: "submitted"` sends it for review. */
export function saveVendorProfile(body: VendorProfileSaveBody): Promise<VendorProfileResponse> {
  const status = body.onboarding_status;
  return platformRequest<VendorProfileResponse>("/api/v1/vendor/profile", {
    method: "PUT",
    body: {
      current_step: body.current_step,
      profile_form_data: body.profile_form_data,
      ...(status === "draft" || status === "submitted" || status === "complete" ? { status } : {}),
    },
  });
}

/** Whether a business name is free. The caller's own name counts as free. */
export async function checkBusinessNameAvailable(businessName: string): Promise<{ available: boolean }> {
  const response = await platformRequest<components["schemas"]["VendorBusinessNameAvailabilityResponse"]>(
    "/api/v1/vendor/profile/business-name-available",
    { query: { business_name: businessName.trim() } },
  );
  return { available: response.available };
}

/** AI-written public bio from the current form. */
export function postGenerateVendorBio(profileFormData: Record<string, unknown>): Promise<{ bio: string }> {
  return platformRequest<components["schemas"]["GenerateVendorBioResponse"]>(
    "/api/v1/vendor/onboarding/ai/generate-bio",
    { method: "POST", body: { profile_form_data: profileFormData } },
  );
}

/** Package-coach review of the current form. */
export function postReviewVendorPackages(profileFormData: Record<string, unknown>): Promise<PackageCoachResult> {
  return platformRequest<PackageCoachResult>("/api/v1/vendor/onboarding/ai/review-packages", {
    method: "POST",
    body: { profile_form_data: profileFormData },
  });
}

/** Vision check of one portfolio photo. */
export function postAnalyzePortfolioImage(file: File): Promise<AnalyzePortfolioImageResult> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return platformRequest<AnalyzePortfolioImageResult>("/api/v1/vendor/onboarding/ai/analyze-portfolio-image", {
    method: "POST",
    formData,
  });
}

/** Shown when an onboarding AI call fails and sends no detail. */
export function vendorOnboardingAiErrorMessage(error: unknown): string {
  return getApiErrorDetail(error) ?? "Something went wrong. Try again.";
}

/** Same wording for the listing optimizer's package check. */
export function vendorCopilotErrorMessage(error: unknown): string {
  return vendorOnboardingAiErrorMessage(error);
}

/** Post-launch package coach. The API accepts this as `payload`. */
export function postCopilotReviewPackages(
  profileFormData: Record<string, unknown>,
): Promise<CopilotReviewPackagesResult> {
  return platformRequest<CopilotReviewPackagesResult>("/api/v1/vendor/copilot/review-packages", {
    method: "POST",
    body: { payload: profileFormData },
  });
}

/** Upload a portfolio or profile photo. */
export function uploadImage(file: File): Promise<ImageUploadResult> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return platformRequest<ImageUploadResult>("/api/v1/media/images", { method: "POST", formData });
}

/** Upload a video or document. */
export function uploadFile(file: File): Promise<ImageUploadResult> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return platformRequest<ImageUploadResult>("/api/v1/media/files", { method: "POST", formData });
}
