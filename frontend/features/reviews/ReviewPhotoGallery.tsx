"use client";

import { useState } from "react";
import { PortfolioLightbox } from "@/components/ui/PortfolioLightbox";

type ReviewPhotoGalleryProps = {
  urls: string[] | null | undefined;
  altPrefix?: string;
  className?: string;
};

/**
 * Amazon-style review photo strip: square thumbs that open a full-screen lightbox.
 */
export function ReviewPhotoGallery({
  urls,
  altPrefix = "Review photo",
  className = "",
}: ReviewPhotoGalleryProps) {
  const photos = (urls ?? []).filter((u) => Boolean(u?.trim()));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <ul
        className={`mt-3 flex flex-wrap gap-2 ${className}`.trim()}
        aria-label="Review photos"
      >
        {photos.map((url, i) => (
          <li key={`${url}-${i}`}>
            <button
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="group relative block h-16 w-16 overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200/80 transition hover:ring-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-[72px] sm:w-[72px]"
              aria-label={`${altPrefix} ${i + 1} of ${photos.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
            </button>
          </li>
        ))}
      </ul>
      {lightboxIndex != null ? (
        <PortfolioLightbox
          urls={photos}
          index={lightboxIndex}
          alt={altPrefix}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}
