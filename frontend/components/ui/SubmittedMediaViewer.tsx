"use client";

import { ExternalLink, FileText, Video } from "lucide-react";
import Link from "next/link";
import { PortfolioImageGallery } from "@/components/ui/PortfolioImageGallery";
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
  /** Hide profile block (when shown elsewhere). */
  hideProfile?: boolean;
  compact?: boolean;
  /** Omit section labels (e.g. sidebar rail). */
  hideHeadings?: boolean;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
      {children}
    </h4>
  );
}

function DocumentRow({ file }: { file: SubmittedMediaFile }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 px-4 py-3">
      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-neutral-500">{file.category}</p>
        <p className="mt-0.5 text-sm font-medium text-neutral-900">{file.label}</p>
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

function VideoBlock({ file, compact }: { file: SubmittedMediaFile; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50/50">
      <div className={`bg-neutral-900 ${compact ? "max-h-44" : "max-h-72"}`}>
        <video
          src={file.url}
          controls
          playsInline
          preload="metadata"
          className="h-full max-h-[inherit] w-full object-contain"
        >
          Your browser does not support embedded video.
        </video>
      </div>
      <div className="flex items-start gap-3 px-4 py-3">
        <Video className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-500">{file.category}</p>
          <p className="mt-0.5 text-sm font-medium text-neutral-900">{file.label}</p>
          <Link
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Open original
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
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
}: SubmittedMediaViewerProps) {
  const imageDocuments = bundle.documents.filter(
    (file) => isImageUploadUrl(file.url) && !isPdfUploadUrl(file.url),
  );
  const pdfAndOtherDocuments = bundle.documents.filter(
    (file) => isPdfUploadUrl(file.url) || !isImageUploadUrl(file.url),
  );

  const hasProfile = !hideProfile && (bundle.profileImageUrl || profileInitials);
  const hasPortfolio = bundle.portfolioImageUrls.length > 0;
  const hasVideos = bundle.videos.length > 0;
  const hasDocs = bundle.documents.length > 0;

  if (!hasProfile && !hasPortfolio && !hasVideos && !hasDocs) {
    return (
      <p className="text-sm text-neutral-500">No photos, videos, or documents submitted.</p>
    );
  }

  const heading = (label: string) =>
    hideHeadings ? null : <SectionHeading>{label}</SectionHeading>;

  return (
    <div className="space-y-6">
      {hasProfile ? (
        <div>
          {heading("Profile photo")}
          <PortfolioImageGallery
            urls={bundle.profileImageUrl ? [bundle.profileImageUrl] : []}
            alt={`${subjectName} profile photo`}
            emptyFallback={profileInitials}
            compact={compact}
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
            gridCols={compact ? 2 : 3}
          />
        </div>
      ) : null}

      {hasVideos ? (
        <div>
          {heading(`Videos (${bundle.videos.length})`)}
          <div className="space-y-4">
            {bundle.videos.map((file) => (
              <VideoBlock key={file.url} file={file} compact={compact} />
            ))}
          </div>
        </div>
      ) : null}

      {imageDocuments.length > 0 ? (
        <div>
          {heading("Certificates & documents")}
          <PortfolioImageGallery
            urls={imageDocuments.map((file) => file.url)}
            alt={`${subjectName} submitted document`}
            layout="grid"
            gridCols={compact ? 2 : 2}
          />
          <ul className="mt-3 space-y-2">
            {imageDocuments.map((file) => (
              <li key={file.url} className="text-xs text-neutral-600">
                <span className="font-medium text-neutral-800">{file.category}:</span>{" "}
                {file.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pdfAndOtherDocuments.length > 0 ? (
        <div>
          {heading(`Files (${pdfAndOtherDocuments.length})`)}
          <ul className="space-y-3">
            {pdfAndOtherDocuments.map((file) => (
              <li key={file.url}>
                <DocumentRow file={file} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
