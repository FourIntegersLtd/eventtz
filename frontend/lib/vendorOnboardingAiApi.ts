import api from "./axios";
import { getApiErrorDetail } from "./api-errors";

/** When true, onboarding skips POST /analyze-portfolio-image (no OpenAI vision call). */
export const SKIP_PORTFOLIO_IMAGE_ANALYSIS = true;

export type GenerateVendorBioResult = { bio: string };

export async function postGenerateVendorBio(
  payload: Record<string, unknown>,
): Promise<GenerateVendorBioResult> {
  const res = await api.post<GenerateVendorBioResult>(
    "/api/v1/vendor/onboarding/ai/generate-bio",
    { payload },
  );
  return res.data;
}

export type AnalyzePortfolioImageResult = {
  ok: boolean;
  score: number;
  summary: string;
};

export async function postAnalyzePortfolioImage(
  file: File,
): Promise<AnalyzePortfolioImageResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<AnalyzePortfolioImageResult>(
    "/api/v1/vendor/onboarding/ai/analyze-portfolio-image",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export function vendorOnboardingAiErrorMessage(err: unknown): string {
  return getApiErrorDetail(err) ?? "Something went wrong. Try again.";
}
