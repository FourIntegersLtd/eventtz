"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";
import { useIndexedCarousel } from "@/lib/useIndexedCarousel";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const COLLAGE_AUTOPLAY_MS = 4500;
const COLLAGE_AUTOPLAY_RESUME_MS = 10_000;

type PortfolioCollageGalleryProps = {
  photos: string[];
  alt: string;
  emptyFallback?: string;
  className?: string;
};

function CollageImage({
  url,
  index,
  alt,
  className,
  showGalleryButton,
  onOpen,
}: {
  url: string;
  index: number;
  alt: string;
  className: string;
  showGalleryButton?: boolean;
  onOpen: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative flex min-h-0 cursor-zoom-in items-center justify-center overflow-hidden bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`.trim()}
      aria-label={showGalleryButton ? `View ${alt} gallery` : `Open ${alt} photo ${index + 1} fullscreen`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${alt} ${index + 1}`}
        className="block h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
        decoding="async"
      />
      {showGalleryButton ? (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          View Gallery
        </span>
      ) : null}
    </button>
  );
}

export function PortfolioCollageGallery({
  photos,
  alt,
  emptyFallback,
  className = "",
}: PortfolioCollageGalleryProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const autoplayResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const photosKey = photos.join("|");
  const { index, goTo, goNext, goPrev, setIndex } = useIndexedCarousel({
    count: photos.length,
    resetKey: photosKey,
    autoplayMs: COLLAGE_AUTOPLAY_MS,
    autoplayEnabled: !reduceMotion && !autoplayPaused && !lightboxOpen,
  });

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

  const openLightbox = (nextIndex: number) => {
    setIndex(nextIndex);
    setLightboxOpen(true);
    pauseAutoplay();
  };

  const goToPhoto = (nextIndex: number) => {
    goTo(nextIndex);
    pauseAutoplay();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pauseAutoplay();
    swipeStartX.current = event.clientX;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current == null || photos.length <= 1) return;
    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) goPrev();
    else goNext();
    pauseAutoplay();
  };

  const lightbox = lightboxOpen ? (
    <PortfolioLightbox
      urls={photos}
      index={index}
      alt={alt}
      onClose={() => setLightboxOpen(false)}
      onIndexChange={setIndex}
    />
  ) : null;

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

  const desktop = (desktopClassName: string, children: ReactNode) => (
    <div className={`hidden md:block ${desktopClassName}`.trim()}>{children}</div>
  );

  const mobileCarousel = (
    <div
      className={`portfolio-mobile-carousel relative overflow-hidden bg-neutral-950 max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:hidden ${className}`.trim()}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStartX.current = null;
      }}
    >
      <div
        className="relative aspect-[4/5] w-full"
        onClick={() => openLightbox(index)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(index);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${alt} photo ${index + 1} fullscreen`}
      >
        <div className="absolute inset-0">
          {photos.map((url, photoIndex) => {
            const isActive = photoIndex === index;
            return (
              <div
                key={url}
                className={`portfolio-carousel-slide ${isActive ? "is-active" : ""}`.trim()}
                aria-hidden={!isActive}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={isActive ? `${alt} ${photoIndex + 1}` : ""}
                  loading={photoIndex <= 2 ? "eager" : "lazy"}
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
            openLightbox(index);
          }}
          className="portfolio-carousel-view-gallery"
          aria-label={`View ${alt} gallery`}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          View Gallery
        </button>
      </div>
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goToPhoto(index - 1)}
            className="portfolio-carousel-arrow portfolio-carousel-arrow--prev"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goToPhoto(index + 1)}
            className="portfolio-carousel-arrow portfolio-carousel-arrow--next"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );

  const hero = photos[0];
  const topRight = photos[1];
  const bottomRight = photos[2];

  let desktopCollage: ReactNode = null;
  if (photos.length === 1 && hero) {
    desktopCollage = desktop(
      className,
      <CollageImage
        url={hero}
        index={0}
        alt={alt}
        className="aspect-[16/10] w-full overflow-hidden rounded-2xl"
        showGalleryButton
        onOpen={() => openLightbox(0)}
      />,
    );
  } else if (photos.length === 2 && hero && topRight) {
    desktopCollage = desktop(
      `grid gap-1 overflow-hidden rounded-2xl ${className}`,
      <div className="grid gap-1 md:aspect-[16/10] md:grid-cols-[1.35fr_1fr] md:grid-rows-2">
        <div className="md:row-span-2 md:min-h-0">
          <CollageImage url={hero} index={0} alt={alt} className="aspect-[4/3] w-full md:aspect-auto md:h-full" onOpen={openLightbox} />
        </div>
        <div className="md:col-start-2 md:row-span-2 md:min-h-0">
          <CollageImage
            url={topRight}
            index={1}
            alt={alt}
            className="aspect-[4/3] w-full md:aspect-auto md:h-full"
            showGalleryButton
            onOpen={() => openLightbox(0)}
          />
        </div>
      </div>,
    );
  } else {
    desktopCollage = desktop(
      `grid gap-1 overflow-hidden rounded-2xl ${className}`,
      <div className="grid gap-1 md:aspect-[16/10] md:grid-cols-[1.35fr_1fr] md:grid-rows-2">
        {hero ? (
          <div className="md:row-span-2 md:min-h-0">
            <CollageImage url={hero} index={0} alt={alt} className="aspect-[4/3] w-full md:aspect-auto md:h-full" onOpen={openLightbox} />
          </div>
        ) : null}
        {topRight ? (
          <div className="md:col-start-2 md:row-start-1 md:min-h-0">
            <CollageImage url={topRight} index={1} alt={alt} className="aspect-[4/3] w-full md:aspect-auto md:h-full" onOpen={openLightbox} />
          </div>
        ) : null}
        {bottomRight ? (
          <div className="md:col-start-2 md:row-start-2 md:min-h-0">
            <CollageImage
              url={bottomRight}
              index={2}
              alt={alt}
              className="aspect-[4/3] w-full md:aspect-auto md:h-full"
              showGalleryButton
              onOpen={() => openLightbox(0)}
            />
          </div>
        ) : null}
      </div>,
    );
  }

  return (
    <>
      {mobileCarousel}
      {desktopCollage}
      {lightbox}
    </>
  );
}
