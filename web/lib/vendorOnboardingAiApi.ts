import type { WithFields } from "@/lib/apiTypeHelpers";
import type { components } from "@/lib/api-schema";
import api from "./axios";
import { uploadImage } from "./mediaApi";
import { getApiErrorDetail } from "./api-errors";

/** When true, onboarding skips POST /analyze-portfolio-image (no OpenAI vision call). */
export const SKIP_PORTFOLIO_IMAGE_ANALYSIS = true;

export type GenerateVendorBioResult = components["schemas"]["GenerateVendorBioResponse"];

export async function postGenerateVendorBio(
  profileFormData: Record<string, unknown>,
): Promise<GenerateVendorBioResult> {
  const res = await api.post<GenerateVendorBioResult>(
    "/api/v1/vendor/onboarding/ai/generate-bio",
    { profile_form_data: profileFormData },
  );
  return res.data;
}

export type AnalyzePortfolioImageResult = components["schemas"]["AnalyzePortfolioImageResponse"];

/**
 * The suggestion fields are optional here because the screens also build local feedback rows
 * (the model leaves them null when it has nothing to suggest).
 */
export type PackageCoachPackageFeedback = Pick<
  components["schemas"]["PackageCoachPackageFeedback"],
  "package_title" | "items"
> &
  Partial<Omit<components["schemas"]["PackageCoachPackageFeedback"], "package_title" | "items">>;

export type PackageCoachTip = components["schemas"]["PackageCoachTip"];

/** `summary` and `tips` are optional and `applied_package_ids` is added: the panels build local results. */
export type PackageCoachResult = WithFields<
  components["schemas"]["ReviewVendorPackagesResponse"],
  {
    summary?: string;
    tips?: PackageCoachTip[];
    applied_package_ids?: string[];
    package_feedback: PackageCoachPackageFeedback[];
  }
>;

export async function postReviewVendorPackages(
  profileFormData: Record<string, unknown>,
): Promise<PackageCoachResult> {
  const res = await api.post<PackageCoachResult>(
    "/api/v1/vendor/onboarding/ai/review-packages",
    { profile_form_data: profileFormData },
  );
  return res.data;
}

export async function postAnalyzePortfolioImage(
  file: File,
): Promise<AnalyzePortfolioImageResult> {
  const uploaded = await uploadImage(file);
  const res = await api.post<AnalyzePortfolioImageResult>(
    "/api/v1/vendor/onboarding/ai/analyze-portfolio-image-url",
    { image_url: uploaded.public_url },
  );
  return res.data;
}

export function vendorOnboardingAiErrorMessage(err: unknown): string {
  return getApiErrorDetail(err) ?? "Something went wrong. Try again.";
}
