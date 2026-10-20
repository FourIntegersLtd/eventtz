import api from "./axios";
import { multipartUploadConfig } from "./mediaApi";
import { getApiErrorDetail } from "./api-errors";

/** When true, onboarding skips POST /analyze-portfolio-image (no OpenAI vision call). */
export const SKIP_PORTFOLIO_IMAGE_ANALYSIS = true;

export type GenerateVendorBioResult = { bio: string };

export async function postGenerateVendorBio(
  profileFormData: Record<string, unknown>,
): Promise<GenerateVendorBioResult> {
  const res = await api.post<GenerateVendorBioResult>(
    "/api/v1/vendor/onboarding/ai/generate-bio",
    { profile_form_data: profileFormData },
  );
  return res.data;
}

export type AnalyzePortfolioImageResult = {
  ok: boolean;
  score: number;
  summary: string;
};

export type PackageCoachPackageFeedback = {
  package_id?: string | null;
  package_title: string;
  items: string[];
  suggested_title?: string | null;
  suggested_details?: string | null;
  suggested_duration?: string | null;
};

export type PackageCoachTip = {
  severity: "tip" | "suggestion" | string;
  package_id?: string | null;
  package_title?: string | null;
  code: string;
  message: string;
};

export type PackageCoachResult = {
  overall_ok: boolean;
  summary?: string;
  package_feedback: PackageCoachPackageFeedback[];
  tips?: PackageCoachTip[];
  applied_package_ids?: string[];
};

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
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<AnalyzePortfolioImageResult>(
    "/api/v1/vendor/onboarding/ai/analyze-portfolio-image",
    fd,
    multipartUploadConfig(60_000),
  );
  return res.data;
}

export function vendorOnboardingAiErrorMessage(err: unknown): string {
  return getApiErrorDetail(err) ?? "Something went wrong. Try again.";
}
