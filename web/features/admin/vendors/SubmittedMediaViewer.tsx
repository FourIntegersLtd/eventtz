"use client";

import { ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { PortfolioImageGallery } from "@/features/vendors/display/PortfolioImageGallery";
import { PortfolioVideoStrip } from "@/features/vendors/display/PortfolioVideoStrip";
import {
  isImageUploadUrl,
  isPdfUploadUrl,
  type SubmittedMediaBundle,
  type SubmittedMediaFile,
} from "@/lib/submittedMediaUtils";

type SubmittedMediaViewerProps = {
  bundle: SubmittedMediaBundle;
  /** Used for image alt text (e.g. business name). */
  subjectName: string;
  /** Profile initials when no profile photo. */
  profileInitials?: string;
  /** Hide profile block (when shown elsewhere or in cover picker). */
  hideProfile?: boolean;
  compact?: boolean;
  /** Omit section labels (e.g. sidebar rail). */
  hideHeadings?: boolean;
  /** Hide portfolio grid (when cover picker shows it). */
  hidePortfolio?: boolean;
};

function SectionHeading({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <h4
      className={
        compact
          ? "mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3"
          : "mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-3"
      }
    >
      {children}
    </h4>
  );
}

function DocumentRow({ file, compact }: { file: SubmittedMediaFile; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs">
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 truncate text-ink-2">{file.label}</span>
        <Link
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
        >
          Open
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-3/50 px-4 py-3">
      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-3">{file.category}</p>
        <p className="mt-0.5 text-sm font-medium text-ink">{file.label}</p>
        <Link
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Open document
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function SubmittedMediaViewer({
  bundle,
  subjectName,
  profileInitials,
  hideProfile = false,
  compact = false,
  hideHeadings = false,
  hidePortfolio = false,
}: SubmittedMediaViewerProps) {
  const imageDocuments = bundle.documents.filter(
    (file) => isImageUploadUrl(file.url) && !isPdfUploadUrl(file.url),
  );
  const pdfAndOtherDocuments = bundle.documents.filter(
    (file) => isPdfUploadUrl(file.url) || !isImageUploadUrl(file.url),
  );

  const hasProfile = !hideProfile && (bundle.profileImageUrl || profileInitials);
  const hasPortfolio = !hidePortfolio && bundle.portfolioImageUrls.length > 0;
  const hasVideos = bundle.videos.length > 0;
  const hasDocs = bundle.documents.length > 0;

  if (!hasProfile && !hasPortfolio && !hasVideos && !hasDocs) {
    return (
      <p className="text-sm text-ink-3">No photos, videos, or documents submitted.</p>
    );
  }

  const heading = (label: string) =>
    hideHeadings ? null : <SectionHeading compact={compact}>{label}</SectionHeading>;

  return (
    <div className={compact ? "flex flex-col gap-3" : "ez-stack ez-stack--lg"}>
      {hasProfile ? (
        <div className={compact ? "max-w-[4.5rem]" : undefined}>
          {heading("Profile photo")}
          <PortfolioImageGallery
            urls={bundle.profileImageUrl ? [bundle.profileImageUrl] : []}
            alt={`${subjectName} profile photo`}
            emptyFallback={profileInitials}
            compact={compact}
            layout={compact ? "grid" : "hero"}
            className={compact ? "rounded-none border-0" : undefined}
          />
        </div>
      ) : null}

      {hasPortfolio ? (
        <div>
          {heading(`Portfolio photos (${bundle.portfolioImageUrls.length})`)}
          <PortfolioImageGallery
            urls={bundle.portfolioImageUrls}
            alt={`${subjectName} portfolio`}
            layout="grid"
            compact={compact}
            gridCols={compact ? 3 : 3}
          />
        </div>
      ) : null}

      {hasVideos ? (
        <div className="min-w-0">
          {heading(`Videos (${bundle.videos.length})`)}
          <PortfolioVideoStrip
            compact={compact}
            videos={bundle.videos.map((file) => ({
              src: file.url,
              label: file.label,
            }))}
          />
        </div>
      ) : null}

      {imageDocuments.length > 0 ? (
        <div>
          {heading("Certificates & documents")}
          <PortfolioImageGallery
            urls={imageDocuments.map((file) => file.url)}
            alt={`${subjectName} submitted document`}
            layout="grid"
            compact={compact}
            gridCols={compact ? 3 : 2}
          />
          {!compact ? (
            <ul className="mt-3 space-y-2">
              {imageDocuments.map((file) => (
                <li key={file.url} className="text-xs text-ink-2">
                  <span className="font-medium text-ink">{file.category}:</span>{" "}
                  {file.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {pdfAndOtherDocuments.length > 0 ? (
        <div>
          {heading(`Files (${pdfAndOtherDocuments.length})`)}
          <ul className={compact ? "space-y-1" : "space-y-3"}>
            {pdfAndOtherDocuments.map((file) => (
              <li key={file.url}>
                <DocumentRow file={file} compact={compact} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
