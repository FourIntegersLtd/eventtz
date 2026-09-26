import { platformRequest, type components } from "@/foundation/platform-client";

/** The vendor's onboarding form and listing state, as `GET /vendor/profile` returns it. */
export type VendorProfileState = components["schemas"]["VendorProfileState"];
export type VendorProfilePutBody = components["schemas"]["VendorProfilePutBody"];
export type AnalyzePortfolioImageResponse = components["schemas"]["AnalyzePortfolioImageResponse"];
export type ReviewVendorPackagesResponse = components["schemas"]["ReviewVendorPackagesResponse"];
export type VendorOwnerReviewsResponse = components["schemas"]["VendorOwnerReviewsResponse"];
export type VendorOwnerReviewItem = components["schemas"]["VendorOwnerReviewItem"];

/** Free-form fields the onboarding form saves under `profile_form_data`. */
export interface VendorProfileFormData {
  businessName?: string;
  bio?: string;
  servicesOffered?: string;
  profileImageUrl?: string | null;
  portfolioFileNames?: string[];
  [key: string]: unknown;
}

/** Fetch the caller's vendor profile (onboarding form + listing state). */
export function fetchVendorProfile(): Promise<VendorProfileState> {
  return platformRequest<VendorProfileState>("/api/v1/vendor/profile");
}

/** Save one step of the onboarding form. `status: "submitted"` sends it for review. */
export function saveVendorProfile(body: VendorProfilePutBody): Promise<VendorProfileState> {
  return platformRequest<VendorProfileState>("/api/v1/vendor/profile", { method: "PUT", body });
}

/** Whether a business name is free to take (the caller's own name always counts as free). */
export async function checkBusinessNameAvailable(businessName: string): Promise<boolean> {
  const response = await platformRequest<components["schemas"]["VendorBusinessNameAvailabilityResponse"]>(
    "/api/v1/vendor/profile/business-name-available",
    { query: { business_name: businessName.trim() } },
  );
  return response.available;
}

/** AI-written public bio, from the vendor's current form data. */
export async function generateVendorBio(profileFormData: VendorProfileFormData): Promise<string> {
  const response = await platformRequest<components["schemas"]["GenerateVendorBioResponse"]>(
    "/api/v1/vendor/onboarding/ai/generate-bio",
    { method: "POST", body: { profile_form_data: profileFormData } },
  );
  return response.bio;
}

/** AI review of a portfolio photo before it's added to the listing. */
export function analyzePortfolioImage(file: File): Promise<AnalyzePortfolioImageResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return platformRequest<AnalyzePortfolioImageResponse>("/api/v1/vendor/onboarding/ai/analyze-portfolio-image", {
    method: "POST",
    formData,
  });
}

/** AI package coach: reviews the vendor's service packages for gaps or unclear pricing. */
export function reviewVendorPackages(profileFormData: VendorProfileFormData): Promise<ReviewVendorPackagesResponse> {
  return platformRequest<ReviewVendorPackagesResponse>("/api/v1/vendor/onboarding/ai/review-packages", {
    method: "POST",
    body: { profile_form_data: profileFormData },
  });
}

/** Fetch every visible review left for the signed-in vendor, newest first. */
export function fetchOwnReviews(): Promise<VendorOwnerReviewsResponse> {
  return platformRequest<VendorOwnerReviewsResponse>("/api/v1/vendor/reviews");
}
