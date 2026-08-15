"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { LayoutGrid } from "lucide-react";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";

export type PortfolioImageGalleryLayout = "hero" | "grid" | "collage";

const COLLAGE_AUTOPLAY_MS = 4500;
const COLLAGE_AUTOPLAY_RESUME_MS = 10_000;

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
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const autoplayResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const photosKey = photos.join("|");

  useEffect(() => {
    setActivePhotoIndex(0);
    setLightboxOpen(false);
    setAutoplayPaused(false);
  }, [photosKey]);

  useEffect(
    () => () => {
      if (autoplayResumeTimer.current) clearTimeout(autoplayResumeTimer.current);
    },
    [],
  );

  const pauseAutoplay = useCallback(() => {
    setAutoplayPaused(true);
    if (autoplayResumeTimer.current) clearTimeout(autoplayResumeTimer.current);
    autoplayResumeTimer.current = setTimeout(() => {
      setAutoplayPaused(false);
    }, COLLAGE_AUTOPLAY_RESUME_MS);
  }, []);

  const changePhoto = useCallback(
    (next: number) => {
      if (photos.length === 0) return;
      const normalized = ((next % photos.length) + photos.length) % photos.length;
      setActivePhotoIndex((current) => (normalized === current ? current : normalized));
    },
    [photos.length],
  );

  const activePhotoUrl =
    photos.length > 0 ? photos[Math.min(activePhotoIndex, photos.length - 1)] : null;

  const openLightbox = (index: number) => {
    setActivePhotoIndex(index);
    setLightboxOpen(true);
    pauseAutoplay();
  };

  const goToPhoto = useCallback(
    (index: number) => {
      changePhoto(index);
      pauseAutoplay();
    },
    [changePhoto, pauseAutoplay],
  );

  useEffect(() => {
    if (layout !== "collage") return;
    if (photos.length <= 1 || autoplayPaused || lightboxOpen) return;
    const timer = setInterval(() => {
      changePhoto(activePhotoIndex + 1);
    }, COLLAGE_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [
    activePhotoIndex,
    autoplayPaused,
    changePhoto,
    layout,
    lightboxOpen,
    photos.length,
    photosKey,
  ]);

  const handleCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pauseAutoplay();
    swipeStartX.current = event.clientX;
  };

  const handleCarouselPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current == null || photos.length <= 1) return;
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) goToPhoto(activePhotoIndex - 1);
    else goToPhoto(activePhotoIndex + 1);
  };

  const gridClass = gridCols === 3 ? "grid-cols-3" : "grid-cols-2";

  const collageHero = photos[0] ?? null;
  const collageTopRight = photos[1] ?? null;
  const collageBottomRight = photos.length >= 3 ? photos[2] : null;

  const renderCollageImage = (
    url: string,
    index: number,
    className: string,
    options?: { showGalleryButton?: boolean; openGalleryFromStart?: boolean },
  ) => (
    <button
      key={`${url}-${index}`}
      type="button"
      onClick={() => openLightbox(options?.openGalleryFromStart ? 0 : index)}
      className={`group relative flex min-h-0 cursor-zoom-in items-center justify-center overflow-hidden bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`.trim()}
      aria-label={
        options?.showGalleryButton
          ? `View ${alt} gallery`
          : `Open ${alt} photo ${index + 1} fullscreen`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${alt} ${index + 1}`}
        className="block h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
        decoding="async"
      />
      {options?.showGalleryButton ? (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          View Gallery
        </span>
      ) : null}
    </button>
  );

  const renderCollageLightbox = () =>
    lightboxOpen ? (
      <PortfolioLightbox
        urls={photos}
        index={activePhotoIndex}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActivePhotoIndex}
      />
    ) : null;

  const renderCollageMobileCarousel = () => {
    if (photos.length === 0) return null;

    const showControls = photos.length > 1;

    return (
      <div
        className={`portfolio-mobile-carousel relative overflow-hidden bg-neutral-950 max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:hidden ${className}`.trim()}
        onPointerDown={handleCarouselPointerDown}
        onPointerUp={handleCarouselPointerUp}
        onPointerCancel={() => {
          swipeStartX.current = null;
        }}
      >
        <div
          className="relative aspect-[4/5] w-full"
          onClick={() => openLightbox(activePhotoIndex)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openLightbox(activePhotoIndex);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${alt} photo ${activePhotoIndex + 1} fullscreen`}
        >
          <div className="absolute inset-0">
            {photos.map((url, index) => {
              const isActive = index === activePhotoIndex;
              return (
                <div
                  key={url}
                  className={`portfolio-carousel-slide ${isActive ? "is-active" : ""}`.trim()}
                  aria-hidden={!isActive}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={isActive ? `${alt} ${index + 1}` : ""}
                    loading={index <= 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openLightbox(activePhotoIndex);
            }}
            className="portfolio-carousel-view-gallery"
            aria-label={`View ${alt} gallery`}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            View Gallery
          </button>
        </div>

        {showControls ? (
          <>
            <button
              type="button"
              onClick={() => goToPhoto(activePhotoIndex - 1)}
              className="portfolio-carousel-arrow portfolio-carousel-arrow--prev"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goToPhoto(activePhotoIndex + 1)}
              className="portfolio-carousel-arrow portfolio-carousel-arrow--next"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    );
  };

  const renderCollageDesktop = (desktopClassName: string, children: ReactNode) => (
    <div className={`hidden md:block ${desktopClassName}`.trim()}>{children}</div>
  );

  if (layout === "collage") {
    if (photos.length === 0) {
      return (
        <div
          className={`flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-100 via-white to-neutral-50 ${className}`.trim()}
        >
          <span className="font-heading text-4xl font-semibold tracking-tight text-neutral-300 sm:text-5xl">
            {emptyFallback?.slice(0, 1).toUpperCase() ?? "?"}
          </span>
        </div>
      );
    }

    if (photos.length === 1 && collageHero) {
      return (
        <>
          {renderCollageMobileCarousel()}
          {renderCollageDesktop(
            className,
            renderCollageImage(
              collageHero,
              0,
              "aspect-[16/10] w-full overflow-hidden rounded-2xl",
              { showGalleryButton: true },
            ),
          )}
          {renderCollageLightbox()}
        </>
      );
    }

    if (photos.length === 2 && collageHero && collageTopRight) {
      return (
        <>
          {renderCollageMobileCarousel()}
          {renderCollageDesktop(
            `grid gap-1 overflow-hidden rounded-2xl ${className}`,
            <div className="grid gap-1 md:aspect-[16/10] md:grid-cols-[1.35fr_1fr] md:grid-rows-2">
              <div className="md:row-span-2 md:min-h-0">
                {renderCollageImage(
                  collageHero,
                  0,
                  "aspect-[4/3] w-full md:aspect-auto md:h-full",
                )}
              </div>
              <div className="md:col-start-2 md:row-span-2 md:min-h-0">
                {renderCollageImage(
                  collageTopRight,
                  1,
                  "aspect-[4/3] w-full md:aspect-auto md:h-full",
                  { showGalleryButton: true, openGalleryFromStart: true },
                )}
              </div>
            </div>,
          )}
          {renderCollageLightbox()}
        </>
      );
    }

    return (
      <>
        {renderCollageMobileCarousel()}
        {renderCollageDesktop(
          `grid gap-1 overflow-hidden rounded-2xl ${className}`,
          <div className="grid gap-1 md:aspect-[16/10] md:grid-cols-[1.35fr_1fr] md:grid-rows-2">
            {collageHero ? (
              <div className="md:row-span-2 md:min-h-0">
                {renderCollageImage(
                  collageHero,
                  0,
                  "aspect-[4/3] w-full md:aspect-auto md:h-full",
                )}
              </div>
            ) : null}
            {collageTopRight ? (
              <div className="md:col-start-2 md:row-start-1 md:min-h-0">
                {renderCollageImage(
                  collageTopRight,
                  1,
                  "aspect-[4/3] w-full md:aspect-auto md:h-full",
                )}
              </div>
            ) : null}
            {collageBottomRight ? (
              <div className="md:col-start-2 md:row-start-2 md:min-h-0">
                {renderCollageImage(
                  collageBottomRight,
                  2,
                  "aspect-[4/3] w-full md:aspect-auto md:h-full",
                  { showGalleryButton: true, openGalleryFromStart: true },
                )}
              </div>
            ) : null}
          </div>,
        )}
        {renderCollageLightbox()}
      </>
    );
  }

  if (layout === "grid") {
    if (photos.length === 0) {
      return (
        <p className={`rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400 ${className}`.trim()}>
          No photos uploaded
        </p>
      );
    }

    return (
      <>
        <div className={`grid gap-2 ${gridClass} ${className}`.trim()}>
          {photos.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => openLightbox(index)}
              className="group flex aspect-[4/3] cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 transition hover:border-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Open ${alt} photo ${index + 1} fullscreen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${alt} ${index + 1}`}
                className="max-h-full max-w-full object-contain object-center transition duration-300 group-hover:scale-[1.02]"
                decoding="async"
              />
            </button>
          ))}
        </div>
        {lightboxOpen ? (
          <PortfolioLightbox
            urls={photos}
            index={activePhotoIndex}
            alt={alt}
            onClose={() => setLightboxOpen(false)}
            onIndexChange={setActivePhotoIndex}
          />
        ) : null}
      </>
    );
  }

  const heroMinH = compact ? "min-h-[10rem]" : "min-h-[12rem] sm:min-h-[16rem]";
  const heroMaxH = compact
    ? "max-h-[min(80vw,320px)]"
    : "max-h-[min(90vw,560px)] lg:max-h-[620px]";
  const thumbH = compact ? "h-14 w-[4.25rem]" : "h-[4.5rem] w-[5.5rem]";

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
      {lightboxOpen && photos.length > 0 ? (
        <PortfolioLightbox
          urls={photos}
          index={activePhotoIndex}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setActivePhotoIndex}
        />
      ) : null}
    </>
  );
}
