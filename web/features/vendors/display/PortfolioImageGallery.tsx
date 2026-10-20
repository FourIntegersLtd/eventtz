"use client";

import { useMemo, useState } from "react";
import { PortfolioCollageGallery } from "@/features/vendors/display/PortfolioCollageGallery";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";

export type PortfolioImageGalleryLayout = "hero" | "grid" | "collage";

export type PortfolioImageGalleryProps = {
  urls: string[];
  alt: string;
  /** Shown when there are no images (hero layout only). */
  emptyFallback?: string;
  layout?: PortfolioImageGalleryLayout;
  className?: string;
  /** Smaller preview heights for sidebars and admin panels. */
  compact?: boolean;
  /** grid layout column count */
  gridCols?: 2 | 3;
};

export function PortfolioImageGallery({
  urls,
  alt,
  emptyFallback,
  layout = "hero",
  className = "",
  compact = false,
  gridCols = 2,
}: PortfolioImageGalleryProps) {
  const photos = useMemo(() => urls.filter((url) => Boolean(url?.trim())), [urls]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const useCompactGrid = compact && (layout === "hero" || layout === "grid");

  if (layout === "collage") {
    return (
      <PortfolioCollageGallery
        photos={photos}
        alt={alt}
        emptyFallback={emptyFallback}
        className={className}
      />
    );
  }

  const openLightbox = (index: number) => {
    setActivePhotoIndex(index);
    setLightboxOpen(true);
  };

  const lightbox =
    lightboxOpen && photos.length > 0 ? (
      <PortfolioLightbox
        urls={photos}
        index={activePhotoIndex}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActivePhotoIndex}
      />
    ) : null;

  if (layout === "grid" || useCompactGrid) {
    if (photos.length === 0) {
      if (emptyFallback?.trim()) {
        return (
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 font-heading text-lg font-semibold text-neutral-400 ${className}`.trim()}
          >
            {emptyFallback.slice(0, 1).toUpperCase()}
          </div>
        );
      }
      return (
        <p
          className={`rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-center text-xs text-neutral-400 ${className}`.trim()}
        >
          No photos uploaded
        </p>
      );
    }

    const gridClass = compact
      ? "grid-cols-5 sm:grid-cols-6 md:grid-cols-8"
      : gridCols === 3
        ? "grid-cols-3"
        : "grid-cols-2";
    const cellClass = compact ? "h-14 w-full" : "aspect-[4/3]";
    return (
      <>
        <div className={`grid gap-1.5 ${gridClass} ${className}`.trim()}>
          {photos.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => openLightbox(index)}
              className={`group flex ${cellClass} cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 transition hover:border-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
              aria-label={`Open ${alt} photo ${index + 1} fullscreen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${alt} ${index + 1}`}
                className={
                  compact
                    ? "h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                    : "max-h-full max-w-full object-contain object-center transition duration-300 group-hover:scale-[1.02]"
                }
                decoding="async"
              />
            </button>
          ))}
        </div>
        {lightbox}
      </>
    );
  }

  const heroMinH = compact ? "min-h-[10rem]" : "min-h-[12rem] sm:min-h-[16rem]";
  const heroMaxH = compact
    ? "max-h-[min(80vw,320px)]"
    : "max-h-[min(90vw,560px)] lg:max-h-[620px]";
  const thumbH = compact ? "h-14 w-[4.25rem]" : "h-[4.5rem] w-[5.5rem]";
  const activePhotoUrl =
    photos.length > 0 ? photos[Math.min(activePhotoIndex, photos.length - 1)] : null;

  return (
    <>
      <div className={`overflow-hidden rounded-2xl border border-neutral-100 bg-white ${className}`.trim()}>
        <div
          className={`relative flex ${heroMinH} ${heroMaxH} w-full items-center justify-center overflow-hidden bg-white`}
        >
          {activePhotoUrl ? (
            <button
              type="button"
              onClick={() => openLightbox(activePhotoIndex)}
              className="group flex w-full cursor-zoom-in items-center justify-center px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset sm:px-3 sm:py-4"
              aria-label={`Open ${alt} fullscreen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhotoUrl}
                alt={alt}
                className={`max-w-full object-contain object-center transition duration-300 group-hover:scale-[1.01] ${heroMaxH}`}
                decoding="async"
              />
            </button>
          ) : (
            <div
              className={`flex ${heroMinH} w-full items-center justify-center bg-gradient-to-br from-neutral-100 via-white to-neutral-50`}
            >
              <span className="font-heading text-4xl font-semibold tracking-tight text-neutral-300 sm:text-5xl">
                {emptyFallback?.slice(0, 1).toUpperCase() ?? "?"}
              </span>
            </div>
          )}
        </div>
        {photos.length > 1 ? (
          <div className="flex shrink-0 gap-2.5 overflow-x-auto border-t border-neutral-100 px-3 py-3.5">
            {photos.map((url, index) => {
              const selected = index === activePhotoIndex;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActivePhotoIndex(index)}
                  onDoubleClick={() => openLightbox(index)}
                  className={`flex ${thumbH} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-2 transition ${
                    selected ? "ring-neutral-400" : "ring-transparent hover:ring-neutral-300"
                  }`}
                  aria-label={`View ${alt} photo ${index + 1}`}
                  aria-pressed={selected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="max-h-full max-w-full object-contain object-center"
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {lightbox}
    </>
  );
}
