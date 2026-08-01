"use client";

import { useId, useState, type Dispatch, type SetStateAction } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { uploadImage } from "@/lib/mediaApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MAX_REVIEW_IMAGES } from "@/features/reviews/reviewImages";

type DraftPhoto = {
  key: string;
  url: string;
  /** Local object URL while uploading; revoked after success/failure. */
  previewUrl?: string;
  uploading?: boolean;
};

type ReviewPhotoPickerProps = {
  urls: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
  disabled?: boolean;
};

/**
 * Amazon-style review photo attachments: add tile + removable square thumbs.
 */
export function ReviewPhotoPicker({ urls, onChange, disabled = false }: ReviewPhotoPickerProps) {
  const inputId = useId();
  const [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadingCount = drafts.filter((d) => d.uploading).length;
  const occupied = urls.length + uploadingCount;
  const remaining = Math.max(0, MAX_REVIEW_IMAGES - occupied);
  const canAdd = !disabled && remaining > 0;

  const revokePreview = (previewUrl?: string) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  };

  const pickFiles = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      setError("Choose image files (JPEG, PNG, or WebP).");
      return;
    }

    const slots = Math.max(0, MAX_REVIEW_IMAGES - urls.length - uploadingCount);
    if (slots <= 0) {
      setError(`You can attach up to ${MAX_REVIEW_IMAGES} photos.`);
      return;
    }

    const batch = list.slice(0, slots);
    if (list.length > slots) {
      setError(`You can attach up to ${MAX_REVIEW_IMAGES} photos.`);
    }

    const pending: DraftPhoto[] = batch.map((file, i) => ({
      key: `up-${Date.now()}-${i}-${file.name}`,
      url: "",
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    }));
    setDrafts((prev) => [...prev, ...pending]);

    for (let i = 0; i < batch.length; i++) {
      const file = batch[i]!;
      const draft = pending[i]!;
      try {
        const res = await uploadImage(file);
        const publicUrl = res.public_url?.trim();
        if (!publicUrl) throw new Error("Upload did not return a URL.");
        onChange((prev) =>
          prev.includes(publicUrl) ? prev : [...prev, publicUrl].slice(0, MAX_REVIEW_IMAGES),
        );
        setDrafts((prev) => {
          const next = prev.filter((d) => d.key !== draft.key);
          revokePreview(draft.previewUrl);
          return next;
        });
      } catch (e: unknown) {
        setError(getApiErrorDetail(e) ?? "Could not upload that photo. Try again.");
        setDrafts((prev) => {
          const next = prev.filter((d) => d.key !== draft.key);
          revokePreview(draft.previewUrl);
          return next;
        });
      }
    }
  };

  const removeUrl = (url: string) => {
    setError(null);
    onChange((prev) => prev.filter((u) => u !== url));
  };

  const showThumbs = urls.length > 0 || drafts.length > 0;

  return (
    <div>
      <p className="text-sm font-medium text-neutral-900">Share photos of your event</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        Optional · up to {MAX_REVIEW_IMAGES} photos
      </p>

      <div className="mt-2.5 flex flex-wrap items-start gap-2">
        {canAdd ? (
          <>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              disabled={disabled}
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void pickFiles(files);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={inputId}
              className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-100 focus-within:ring-2 focus-within:ring-primary/30 sm:h-[72px] sm:w-[72px]"
            >
              <Camera className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              <span className="text-[10px] font-medium leading-tight">Add a photo</span>
            </label>
          </>
        ) : null}

        {urls.map((url) => (
          <div
            key={url}
            className="group relative h-16 w-16 overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200/80 sm:h-[72px] sm:w-[72px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" decoding="async" />
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeUrl(url)}
                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white opacity-100 transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        ))}

        {drafts.map((d) => (
          <div
            key={d.key}
            className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200/80 sm:h-[72px] sm:w-[72px]"
          >
            {d.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.previewUrl}
                alt=""
                className="h-full w-full object-cover opacity-60"
                decoding="async"
              />
            ) : null}
            <Loader2
              className="absolute h-5 w-5 animate-spin text-neutral-700"
              aria-label="Uploading"
            />
          </div>
        ))}
      </div>

      {showThumbs && remaining === 0 && !error ? (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Maximum of {MAX_REVIEW_IMAGES} photos reached.
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
