import { uploadedFileDisplayName } from "@/features/vendor/onboarding/uploadedFileDisplayName";
import type { VendorOnboardingData } from "@/features/vendor/onboarding/types";

export type SubmittedMediaFile = {
  url: string;
  label: string;
  category: string;
};

export type SubmittedMediaBundle = {
  profileImageUrl: string | null;
  portfolioImageUrls: string[];
  videos: SubmittedMediaFile[];
  documents: SubmittedMediaFile[];
};

const IMAGE_EXT = /\.(avif|gif|jpe?g|png|webp)(\?|$)/i;
const PDF_EXT = /\.pdf(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i;

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function isImageUploadUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!isHttpUrl(trimmed)) return false;
  if (IMAGE_EXT.test(trimmed)) return true;
  return !PDF_EXT.test(trimmed) && !VIDEO_EXT.test(trimmed) && /upload|storage|image/i.test(trimmed);
}

export function isPdfUploadUrl(url: string): boolean {
  return isHttpUrl(url) && PDF_EXT.test(url.trim());
}

export function isVideoUploadUrl(url: string): boolean {
  return isHttpUrl(url) && VIDEO_EXT.test(url.trim());
}

function mediaFile(
  url: string,
  labels: Record<string, string>,
  category: string,
  fallbackLabel: string,
): SubmittedMediaFile | null {
  const trimmed = url.trim();
  if (!isHttpUrl(trimmed)) return null;
  return {
    url: trimmed,
    label: uploadedFileDisplayName(trimmed, labels, fallbackLabel),
    category,
  };
}

export function buildSubmittedMediaBundle(data: VendorOnboardingData): SubmittedMediaBundle {
  const labels = data.uploadedFileLabels ?? {};
  const profileImageUrl = String(data.profileImageUrl ?? "").trim();
  const portfolioImageUrls = (Array.isArray(data.portfolioFileNamesPersisted)
    ? data.portfolioFileNamesPersisted
    : []
  )
    .map(String)
    .filter(isHttpUrl);

  const videos = (Array.isArray(data.portfolioVideoNamesPersisted)
    ? data.portfolioVideoNamesPersisted
    : []
  )
    .map((url) => mediaFile(url, labels, "Portfolio video", "Portfolio video"))
    .filter((item): item is SubmittedMediaFile => item != null);

  const documents: SubmittedMediaFile[] = [];

  const food = mediaFile(
    data.foodHygieneCertNamePersisted,
    labels,
    "Food hygiene certificate",
    "Food hygiene certificate",
  );
  if (food) documents.push(food);

  const indemnity = mediaFile(
    data.indemnityCertNamePersisted,
    labels,
    "Indemnity / insurance",
    "Indemnity / insurance certificate",
  );
  if (indemnity) documents.push(indemnity);

  for (const url of Array.isArray(data.otherDocsNamesPersisted) ? data.otherDocsNamesPersisted : []) {
    const doc = mediaFile(url, labels, "Supporting document", "Supporting document");
    if (doc) documents.push(doc);
  }

  return {
    profileImageUrl: isHttpUrl(profileImageUrl) ? profileImageUrl : null,
    portfolioImageUrls,
    videos,
    documents,
  };
}

export function submittedMediaHasContent(bundle: SubmittedMediaBundle): boolean {
  return (
    Boolean(bundle.profileImageUrl) ||
    bundle.portfolioImageUrls.length > 0 ||
    bundle.videos.length > 0 ||
    bundle.documents.length > 0
  );
}
