"use client";

import { Banner } from "@/components/ui/Banner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Upload, Video, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import { filterLikelyImageUploadFiles } from "@/lib/imageUploadFile";
import { MAX_PORTFOLIO_IMAGES, MIN_PORTFOLIO_IMAGES } from "../../../../lib/vendorOnboarding/constants";
import type { PortfolioImageQualityRow } from "../useVendorOnboardingController";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { uploadedFileDisplayName } from "../../../../lib/vendorOnboarding/uploadedFileDisplayName";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getButtonClassName } from "@/components/ui/buttonStyles";

export type StepPortfolioProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  portfolioQuality: Record<string, PortfolioImageQualityRow>;
  portfolioQualityAccepted: Record<string, boolean>;
  onRemovePortfolioFile: (index: number) => void;
  onAcceptPortfolioQualityAnyway: (fileKey: string) => void;
  onRemovePersistedPortfolioImage: (url: string) => void;
  uploadingVideo?: boolean;
  videoUploadError?: string | null;
  onUploadPortfolioVideo: (file: File) => void | Promise<void>;
  onRemovePortfolioVideo: (url: string) => void;
  uploadingProfileImage?: boolean;
  profileImageError?: string | null;
  onUploadProfileImage: (file: File) => void | Promise<void>;
};

/** One photo tile (design V06): the image, an optional Cover badge, a remove button and an optional status strip. */
function PhotoTile({
  src,
  label,
  isCover,
  onRemove,
  statusNode,
}: {
  src: string;
  label: string;
  isCover: boolean;
  onRemove: () => void;
  statusNode?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="ez-media-ph aspect-[4/3] overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="w-full h-full object-cover"
        />
      </div>
      {isCover ? (
        <Badge
          tone="brand"
          plain
          className="absolute top-2 left-2">
          Cover
        </Badge>
      ) : null}
      <button
        className="ez-icon-btn absolute right-1 top-1 h-9 w-9 bg-white/[.92]"
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X strokeWidth={1.75} aria-hidden />
      </button>
      {statusNode ? (
        <div
          className="ez-small absolute inset-x-0 bottom-0 rounded-b-[var(--ez-r-card)] bg-black/[.55] px-2 py-1 text-[var(--ez-on-media)]"
        >
          {statusNode}
        </div>
      ) : null}
    </div>
  );
}

/** The profile photo row: the current photo (or initials), a hint and a Change button. */
function ProfilePhotoRow({
  data,
  uploading,
  error,
  onUpload,
}: {
  data: VendorOnboardingData;
  uploading: boolean;
  error: string | null;
  onUpload: (file: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initials =
    `${data.firstName[0] ?? "?"}${data.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="ez-stack ez-stack--sm">
      <div className="ez-hrow">
        <div className="ez-stack ez-stack--sm flex-1">
          <span className="ez-label">Profile photo</span>
          <span className="ez-help">A friendly face or your logo.</span>
        </div>
        {data.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.profileImageUrl}
            alt="Profile"
            className="ez-avatar ez-avatar--lg object-cover"
          />
        ) : (
          <span className="ez-avatar ez-avatar--lg">{initials}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file);
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading..." : "Change"}
        </Button>
      </div>
      {error ? (
        <span
          className="ez-help text-danger"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Portfolio step (design V06): photo upload, photo tiles, profile photo, and optional videos. */
export function StepPortfolio({
  data,
  update,
  portfolioQuality,
  portfolioQualityAccepted,
  onRemovePortfolioFile,
  onAcceptPortfolioQualityAnyway,
  onRemovePersistedPortfolioImage,
  uploadingVideo,
  videoUploadError,
  onUploadPortfolioVideo,
  onRemovePortfolioVideo,
  uploadingProfileImage,
  profileImageError,
  onUploadProfileImage,
}: StepPortfolioProps) {
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of data.portfolioFiles) {
      const k = portfolioFileKey(f);
      next[k] = objectUrls[k] ?? URL.createObjectURL(f);
    }
    setObjectUrls((prev) => {
      for (const [k, url] of Object.entries(prev)) {
        if (!next[k]) URL.revokeObjectURL(url);
      }
      return next;
    });
    // Revoke on unmount.
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.portfolioFiles]);

  const totalCount = useMemo(
    () =>
      new Set([
        ...data.portfolioFileNamesPersisted,
        ...data.portfolioFiles.map((f) => portfolioFileKey(f)),
      ]).size,
    [data.portfolioFileNamesPersisted, data.portfolioFiles],
  );

  const addPortfolioFiles = (files: File[]) => {
    const images = filterLikelyImageUploadFiles(files);
    if (images.length === 0) {
      if (files.length > 0) {
        setDuplicateNotice(
          "Those files don't look like photos. Try JPG, PNG, or HEIC images.",
        );
      }
      return;
    }
    const existingKeys = new Set(
      data.portfolioFiles.map((f) => portfolioFileKey(f)),
    );
    const existingPersistedUrls = new Set(data.portfolioFileNamesPersisted);
    const next: File[] = [...data.portfolioFiles];
    const skippedDuplicates: string[] = [];
    for (const f of images) {
      const key = portfolioFileKey(f);
      if (
        existingKeys.size + existingPersistedUrls.size >=
        MAX_PORTFOLIO_IMAGES
      )
        break;
      if (existingKeys.has(key)) {
        skippedDuplicates.push(f.name);
        continue;
      }
      existingKeys.add(key);
      next.push(f);
    }
    if (skippedDuplicates.length > 0) {
      const label =
        skippedDuplicates.length === 1
          ? `"${skippedDuplicates[0]}"`
          : `${skippedDuplicates.length} images`;
      setDuplicateNotice(
        `${label} already in your portfolio - duplicate${skippedDuplicates.length === 1 ? "" : "s"} skipped.`,
      );
    } else {
      setDuplicateNotice(null);
    }
    update({ portfolioFiles: next });
  };

  const minimumMet = totalCount >= MIN_PORTFOLIO_IMAGES;
  const progressPercent = Math.min(
    100,
    Math.round((totalCount / MIN_PORTFOLIO_IMAGES) * 100),
  );
  const persistedCount = data.portfolioFileNamesPersisted.length;

  return (
    <div className="ez-stack">
      <div
        className="ez-upload"
        style={dragOver ? { borderColor: "var(--ez-brand-700)" } : undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(false);
          addPortfolioFiles(Array.from(event.dataTransfer.files ?? []));
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          id="portfolio-imgs"
          onChange={(event) => {
            addPortfolioFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Upload size={32} strokeWidth={1.75} aria-hidden className="inline align-baseline" />
        <div className="ez-strong mt-2">
          Drag photos here or choose files
        </div>
        <p className="ez-small">
          JPG or PNG, up to 10 MB each. Add {MIN_PORTFOLIO_IMAGES} to{" "}
          {MAX_PORTFOLIO_IMAGES} photos.
        </p>
        <div className="mt-3.5">
          <label className={getButtonClassName({ variant: "secondary" })} htmlFor="portfolio-imgs">
            <Upload size={18} strokeWidth={1.75} aria-hidden />
            Choose photos
          </label>
        </div>
        {duplicateNotice ? (
          <p className="ez-small mt-2">
            {duplicateNotice}
          </p>
        ) : null}
      </div>

      <div className="ez-stack ez-stack--sm">
        <div className="ez-between">
          <span className="ez-label">Your photos</span>
          <Badge tone={minimumMet ? "success" : "warning"}>
            {totalCount} of {MIN_PORTFOLIO_IMAGES} minimum added
          </Badge>
        </div>
        <ProgressBar percent={progressPercent} />
      </div>

      {data.portfolioWarnings.length > 0 ? (
        <Banner tone="warning">
          {data.portfolioWarnings.map((warning) => (
            <p key={warning} className="ez-small text-inherit">
              {warning}
            </p>
          ))}
        </Banner>
      ) : null}

      {persistedCount > 0 || data.portfolioFiles.length > 0 ? (
        <div
          className="ez-grid-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
        >
          {data.portfolioFileNamesPersisted.map((url, index) => (
            <PhotoTile
              key={url}
              src={url}
              label={`photo ${index + 1}`}
              isCover={index === 0}
              onRemove={() => onRemovePersistedPortfolioImage(url)}
            />
          ))}
          {data.portfolioFiles.map((file, index) => {
            const key = portfolioFileKey(file);
            const quality = portfolioQuality[key];
            const accepted = portfolioQualityAccepted[key];
            const src = objectUrls[key];
            const status = quality?.loading ? (
              <span
                className="inline-flex items-center gap-1.5"
              >
                <LoadingSpinner size="sm" className="text-white" />
                Checking quality...
              </span>
            ) : quality ? (
              quality.skipped ? (
                "Check skipped"
              ) : quality.ok ? (
                `OK · ${quality.score ?? "-"}/5`
              ) : accepted ? (
                `Kept anyway · ${quality.score ?? "-"}/5`
              ) : (
                <button
                  type="button"
                  onClick={() => onAcceptPortfolioQualityAnyway(key)}
                  className="underline"
                >
                  Low quality · use anyway?
                </button>
              )
            ) : null;
            return src ? (
              <PhotoTile
                key={`${key}-${index}`}
                src={src}
                label={file.name}
                isCover={persistedCount === 0 && index === 0}
                onRemove={() => onRemovePortfolioFile(index)}
                statusNode={status}
              />
            ) : null;
          })}
        </div>
      ) : null}

      <ProfilePhotoRow
        data={data}
        uploading={Boolean(uploadingProfileImage)}
        error={profileImageError ?? null}
        onUpload={onUploadProfileImage}
      />

      {/* Not in design V06; kept so vendors can still add videos. The design diff strips it. */}
      <div className="ez-stack ez-stack--sm" data-design-extra="videos">
        <span className="ez-label">
          Videos <span className="ez-label__opt">(optional)</span>
        </span>
        <input
          type="file"
          accept="video/*"
          className="hidden"
          id="portfolio-video"
          disabled={uploadingVideo}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUploadPortfolioVideo(file);
            event.target.value = "";
          }}
        />
        <div>
          <label
            className={getButtonClassName({ variant: "secondary", size: "sm" })}
            htmlFor="portfolio-video"
          >
            <Video strokeWidth={1.75} aria-hidden />
            {uploadingVideo ? "Uploading..." : "Upload a video"}
          </label>
        </div>
        {data.portfolioVideoNamesPersisted.map((url) => (
          <div
            key={url}
            className="ez-list-row border-b border-[var(--ez-line)] py-2.5"
          >
            <span className="ez-icon-tile">
              <Video size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="ez-list-row__main">
              <span className="ez-strong">
                {uploadedFileDisplayName(url, data.uploadedFileLabels, "Video")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onRemovePortfolioVideo(url)}>
              <Trash2 strokeWidth={1.75} aria-hidden />
              Remove
            </Button>
          </div>
        ))}
        {videoUploadError ? (
          <span className="ez-help">{videoUploadError}</span>
        ) : null}
      </div>
    </div>
  );
}
