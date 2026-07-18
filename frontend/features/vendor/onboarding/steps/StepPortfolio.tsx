"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Trash2, Video, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { portfolioFileKey } from "@/lib/portfolioFileKey";
import { SOCIAL_PLATFORM_OPTIONS } from "../constants";
import { STEP_COPY } from "../onboardingCopy";
import type { PortfolioImageQualityRow } from "../useVendorOnboardingController";
import {
  createVendorSocialLink,
  type SocialPlatform,
  type VendorOnboardingData,
  type VendorOnboardingUpdate,
} from "../types";
import {
  OnboardingQuestionLayout,
  OnboardingSubQuestion,
} from "../ui/OnboardingQuestionLayout";
import { inputClass } from "./form-primitives";

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
  onRemovePortfolioVideo: () => void;
};

function ImageChip({
  src,
  label,
  onRemove,
  statusNode,
}: {
  src: string;
  label: string;
  onRemove: () => void;
  statusNode?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-28 w-full bg-neutral-50 object-contain object-center" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900/70 text-white shadow-sm transition hover:bg-neutral-900"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      {statusNode ? (
        <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-[11px] text-white">
          {statusNode}
        </div>
      ) : null}
    </div>
  );
}

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

  const addSocialLink = () => {
    const usedPlatforms = new Set(data.socialLinks.map((s) => s.platform));
    const nextPlatform =
      (SOCIAL_PLATFORM_OPTIONS.find((o) => !usedPlatforms.has(o.value))
        ?.value as SocialPlatform | undefined) ?? "instagram";
    update({ socialLinks: [...data.socialLinks, createVendorSocialLink(nextPlatform)] });
  };

  const updateSocialLink = (id: string, patch: Partial<{ platform: SocialPlatform; handle: string }>) => {
    update({
      socialLinks: data.socialLinks.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeSocialLink = (id: string) => {
    update({ socialLinks: data.socialLinks.filter((s) => s.id !== id) });
  };

  const addPortfolioFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const existingKeys = new Set(data.portfolioFiles.map((f) => portfolioFileKey(f)));
    const existingPersistedUrls = new Set(data.portfolioFileNamesPersisted);
    const next: File[] = [...data.portfolioFiles];
    const skippedDuplicates: string[] = [];
    for (const f of images) {
      const key = portfolioFileKey(f);
      if (existingKeys.size + existingPersistedUrls.size >= 20) break;
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
        `${label} already in your portfolio — duplicate${skippedDuplicates.length === 1 ? "" : "s"} skipped.`,
      );
    } else {
      setDuplicateNotice(null);
    }
    update({ portfolioFiles: next });
  };

  return (
    <div className="space-y-8">
      <OnboardingQuestionLayout
        headline={STEP_COPY[6].headline}
        subtext={STEP_COPY[6].subtext}
      />
      <OnboardingSubQuestion headline="Upload your portfolio photos (optional)" indexOffset={3}>
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-primary bg-primary/[0.06]"
              : "border-neutral-200 bg-neutral-50/80"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            addPortfolioFiles(Array.from(e.dataTransfer.files ?? []));
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            id="portfolio-imgs"
            onChange={(e) => {
              addPortfolioFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <label
            htmlFor="portfolio-imgs"
            className="inline-flex cursor-pointer flex-col items-center gap-2 text-primary"
          >
            <ImagePlus className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-sm font-medium hover:underline">
              Drag &amp; drop or click to upload photos
            </span>
          </label>
          <p className="mt-1 text-xs text-neutral-500">
            Optional · up to 20
            {totalCount > 0 ? ` · ${totalCount} selected` : ""}
          </p>
          {duplicateNotice ? (
            <p className="mt-2 text-xs font-medium text-amber-800">{duplicateNotice}</p>
          ) : null}
        </div>

        {(data.portfolioFileNamesPersisted.length > 0 || data.portfolioFiles.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {data.portfolioFileNamesPersisted.map((url) => (
              <ImageChip
                key={url}
                src={url}
                label="Saved photo"
                onRemove={() => onRemovePersistedPortfolioImage(url)}
              />
            ))}
            {data.portfolioFiles.map((file, i) => {
              const key = portfolioFileKey(file);
              const q = portfolioQuality[key];
              const accepted = portfolioQualityAccepted[key];
              const src = objectUrls[key];
              const status = q?.loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <LoadingSpinner size="sm" className="text-neutral-500" />
                  Checking quality…
                </span>
              ) : q && !q.loading ? (
                q.skipped ? (
                  "Check skipped"
                ) : q.ok ? (
                  `OK · ${q.score ?? "—"}/5`
                ) : accepted ? (
                  `Kept anyway · ${q.score ?? "—"}/5`
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
                <ImageChip
                  key={`${key}-${i}`}
                  src={src}
                  label={file.name}
                  onRemove={() => onRemovePortfolioFile(i)}
                  statusNode={status}
                />
              ) : null;
            })}
          </div>
        )}
      </OnboardingSubQuestion>
      {data.portfolioWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {data.portfolioWarnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      <OnboardingSubQuestion headline="Add a video (optional)" indexOffset={6}>
        {data.portfolioVideoNamePersisted ? (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <Video className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
              Video uploaded
            </span>
            <button
              type="button"
              onClick={onRemovePortfolioVideo}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/80 p-6 text-center">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="portfolio-video"
              disabled={uploadingVideo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadPortfolioVideo(f);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="portfolio-video"
              className={`inline-flex cursor-pointer flex-col items-center gap-2 text-primary ${
                uploadingVideo ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <Video className="h-7 w-7" strokeWidth={1.5} />
              <span className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
                {uploadingVideo ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Uploading…
                  </>
                ) : (
                  "Click to upload a short video"
                )}
              </span>
            </label>
          </div>
        )}
        {videoUploadError ? (
          <p className="mt-1 text-xs text-red-700">{videoUploadError}</p>
        ) : null}
      </OnboardingSubQuestion>
      <OnboardingSubQuestion headline="Social media links (optional)" indexOffset={9}>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={addSocialLink}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Add link
          </button>
        </div>
        {data.socialLinks.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Add Instagram, TikTok, or your website.
          </p>
        ) : (
          <div className="space-y-2">
            {data.socialLinks.map((link) => {
              const platformOpt =
                SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === link.platform) ??
                SOCIAL_PLATFORM_OPTIONS[0];
              return (
                <div key={link.id} className="flex gap-2">
                  <select
                    className={`${inputClass()} w-full shrink-0 sm:w-36`}
                    value={link.platform}
                    onChange={(e) =>
                      updateSocialLink(link.id, {
                        platform: e.target.value as SocialPlatform,
                      })
                    }
                  >
                    {SOCIAL_PLATFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass()}
                    value={link.handle}
                    onChange={(e) => updateSocialLink(link.id, { handle: e.target.value })}
                    placeholder={platformOpt.placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => removeSocialLink(link.id)}
                    aria-label="Remove social link"
                    className="shrink-0 rounded-lg p-2.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </OnboardingSubQuestion>
    </div>
  );
}
