"use client";

import { Chip } from "@/components/ui/Chip";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InspirationMobileReel } from "@/features/landing/InspirationMobileReel";
import { InspirationVideoTile } from "@/features/landing/InspirationVideoTile";
import type { GalleryVideo } from "@/features/landing/landingData";
import { useIndexedCarousel } from "@/lib/useIndexedCarousel";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { prefetchLandingVideo } from "@/lib/landingVideo";

const AUTO_MS = 3500;
const AUTO_MS_MOBILE = 4500;

type InspirationVideoShowcaseProps = {
  videos: GalleryVideo[];
};

function relativeOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

export function InspirationVideoShowcase({ videos }: InspirationVideoShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  // Default compact so iPhone Chrome never mounts the 3-clip desktop stack first.
  const [compact, setCompact] = useState(true);
  const reduceMotion = usePrefersReducedMotion();
  const total = videos.length;
  const { index, goTo, goNext, goPrev, progressKey } = useIndexedCarousel({
    count: total,
    autoplayMs: compact ? AUTO_MS_MOBILE : AUTO_MS,
    autoplayEnabled: inView && !reduceMotion,
  });
  const active = videos[index];
  const touchStartX = useRef<number | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "80px 0px", threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || total === 0) return;
    const next = videos[(index + 1) % total]?.src;
    if (next) prefetchLandingVideo(next);
    if (!compact) {
      const prev = videos[(index - 1 + total) % total]?.src;
      if (prev) prefetchLandingVideo(prev);
    }
  }, [compact, index, inView, total, videos]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const startX = touchStartX.current;
      touchStartX.current = null;
      if (startX == null) return;
      const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX;
      if (Math.abs(deltaX) < 40) return;
      if (deltaX < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev],
  );

  if (total === 0 || !active) return null;

  const arrows = (
    <>
      <button
        type="button"
        onClick={goPrev}
        className="absolute left-0 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-white/95 text-ink shadow-md backdrop-blur-sm transition hover:bg-primary-soft sm:left-2 md:h-12 md:w-12"
        aria-label="Previous celebration"
      >
        <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={goNext}
        className="absolute right-0 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-white/95 text-ink shadow-md backdrop-blur-sm transition hover:bg-primary-soft sm:right-2 md:h-12 md:w-12"
        aria-label="Next celebration"
      >
        <ChevronRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
      </button>
    </>
  );

  return (
    <div ref={containerRef} className="relative mt-6 overflow-x-clip md:mt-10 lg:mt-14">
      <div className="relative w-full md:left-1/2 md:w-screen md:max-w-[100vw] md:-translate-x-1/2 md:px-8">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[min(70vw,420px)] w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[80px] md:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[min(50vw,280px)] w-[min(70vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gold/10 blur-[60px] md:block"
          aria-hidden
        />

        {compact ? (
          <div
            className="relative mx-auto aspect-[4/3] max-h-[min(52vw,240px)] w-full max-w-6xl touch-pan-x"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <InspirationMobileReel
              video={active}
              inView={inView}
              reduceMotion={reduceMotion}
              className="aspect-[4/3] max-h-[min(52vw,240px)] w-full rounded-card shadow-md ring-1 ring-line"
            />
            {arrows}
          </div>
        ) : (
          <div
            className="relative mx-auto aspect-auto h-[min(52vw,580px)] w-full max-w-6xl [perspective:1600px]"
            style={{ transformStyle: "preserve-3d" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {videos.map((video, videoIndex) => {
              const offset = relativeOffset(videoIndex, index, total);
              const isActive = videoIndex === index;
              const shouldLoad = inView && Math.abs(offset) <= 1;
              return (
                <div
                  key={video.src}
                  className="inspiration-slide-frame"
                  data-offset={offset}
                  data-active={isActive ? "true" : undefined}
                >
                  <InspirationVideoTile
                    video={video}
                    isActive={isActive}
                    shouldLoad={shouldLoad}
                    showTitle={false}
                    onClick={isActive ? undefined : () => goTo(videoIndex)}
                    className={`aspect-[2.35/1] w-full shadow-md ring-1 ring-line ${
                      isActive
                        ? "rounded-2xl shadow-primary/20 lg:rounded-3xl"
                        : "rounded-xl shadow-primary/15"
                    }`}
                  />
                </div>
              );
            })}
            {arrows}
          </div>
        )}

        <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mt-10">
          <div className="min-w-0 text-center sm:text-left">
            <p className="hidden text-xs font-semibold tabular-nums tracking-[0.25em] text-ink-3 md:block">
              {String(index + 1).padStart(2, "0")}{" "}
              <span className="text-ink-3/50">/</span>{" "}
              {String(total).padStart(2, "0")}
            </p>
            <h3
              key={active.src}
              className="font-heading mt-0 text-lg font-semibold tracking-tight text-ink animate-inspiration-title md:mt-2 md:text-4xl lg:text-5xl"
            >
              {active.eventName}
            </h3>
          </div>

          <div className="hidden flex-wrap gap-2 sm:flex sm:max-w-md sm:justify-end">
            {videos.map((video, videoIndex) => (
              <Chip
                key={video.src}
                active={videoIndex === index}
                onClick={() => goTo(videoIndex)}
                aria-current={videoIndex === index ? "true" : undefined}
              >
                {video.eventName}
              </Chip>
            ))}
          </div>
        </div>

        {total > 1 ? (
          <div className="mx-auto mt-3 flex max-w-5xl justify-center gap-1.5 md:hidden">
            {videos.map((video, videoIndex) => (
              <button
                key={video.src}
                type="button"
                onClick={() => goTo(videoIndex)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  videoIndex === index ? "w-5 bg-primary" : "w-1.5 bg-line-strong"
                }`}
                aria-label={`Show ${video.eventName}`}
                aria-current={videoIndex === index ? "true" : undefined}
              />
            ))}
          </div>
        ) : null}

        {!reduceMotion && total > 1 ? (
          <div className="mx-auto mt-4 h-0.5 max-w-[8rem] overflow-hidden rounded-full bg-line md:mt-6 md:max-w-5xl">
            <div
              key={progressKey}
              className="h-full origin-left bg-gradient-to-r from-primary to-accent-gold animate-inspiration-progress"
              style={{
                animationDuration: `${compact ? AUTO_MS_MOBILE : AUTO_MS}ms`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
