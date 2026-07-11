"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InspirationVideoTile } from "@/features/landing/InspirationVideoTile";
import type { GalleryVideo } from "@/features/landing/landingData";
import { prefetchLandingVideo } from "@/lib/landingVideo";

const AUTO_MS = 5500;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const total = videos.length;
  const active = videos[activeIndex];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setActiveIndex(((index % total) + total) % total);
      setProgressKey((k) => k + 1);
    },
    [total],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    if (reduceMotion || total <= 1 || !inView) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
      setProgressKey((k) => k + 1);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [inView, reduceMotion, total]);

  useEffect(() => {
    if (!inView || total === 0) return;
    const next = videos[(activeIndex + 1) % total]?.src;
    const prev = videos[(activeIndex - 1 + total) % total]?.src;
    if (next) prefetchLandingVideo(next);
    if (prev) prefetchLandingVideo(prev);
  }, [activeIndex, inView, total, videos]);

  if (total === 0 || !active) return null;

  return (
    <div ref={containerRef} className="relative mt-8 overflow-x-clip sm:mt-14">
      <div className="relative w-full md:left-1/2 md:w-screen md:max-w-[100vw] md:-translate-x-1/2 md:px-8">
        {!isMobile ? (
          <>
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,420px)] w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[80px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[min(50vw,280px)] w-[min(70vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gold/10 blur-[60px]"
              aria-hidden
            />
          </>
        ) : null}

        <div
          className={`relative mx-auto max-w-6xl ${
            isMobile
              ? "aspect-[16/10] w-full"
              : "h-[min(52vw,580px)] [perspective:1600px]"
          }`}
          style={isMobile ? undefined : { transformStyle: "preserve-3d" }}
        >
          {videos.map((video, index) => {
            const offset = relativeOffset(index, activeIndex, total);
            if (isMobile ? offset !== 0 : Math.abs(offset) > 1) return null;

            const isActive = offset === 0;
            const shouldLoad = inView && (isMobile || Math.abs(offset) <= 1);
            const absOffset = Math.abs(offset);

            return (
              <div
                key={video.src}
                className={`absolute inset-x-0 mx-auto w-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isMobile ? "inset-y-0" : "top-1/2 max-w-5xl"
                }`}
                style={
                  isMobile
                    ? { zIndex: 20 }
                    : {
                        transform: `
                    translateY(-50%)
                    translateX(${offset * 14}%)
                    translateZ(${isActive ? 80 : -absOffset * 120}px)
                    rotateY(${offset * -14}deg)
                    scale(${isActive ? 1 : 0.88 - absOffset * 0.04})
                  `,
                        opacity: isActive ? 1 : 0.55 - absOffset * 0.1,
                        zIndex: 20 - absOffset,
                        filter: isActive ? "none" : `blur(${absOffset * 1.5}px)`,
                      }
                }
              >
                <InspirationVideoTile
                  video={video}
                  isActive={isActive}
                  shouldLoad={shouldLoad}
                  showTitle={false}
                  onClick={isActive ? undefined : () => goTo(index)}
                  className={`w-full shadow-2xl ${
                    isMobile
                      ? "aspect-[16/10] rounded-xl shadow-primary/15 ring-1 ring-primary-border"
                      : `aspect-[21/9] sm:aspect-[2.35/1] ${
                          isActive
                            ? "rounded-2xl shadow-primary/20 ring-1 ring-primary-border sm:rounded-3xl"
                            : "rounded-xl ring-1 ring-primary-border/60"
                        }`
                  }`}
                />
              </div>
            );
          })}

          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary-border bg-white/95 text-primary shadow-primary-soft backdrop-blur-sm transition hover:bg-primary-soft sm:left-2 sm:h-12 sm:w-12"
            aria-label="Previous celebration"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary-border bg-white/95 text-primary shadow-primary-soft backdrop-blur-sm transition hover:bg-primary-soft sm:right-2 sm:h-12 sm:w-12"
            aria-label="Next celebration"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Active title + counter */}
        <div className="mx-auto mt-6 flex max-w-5xl flex-col gap-4 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tabular-nums tracking-[0.25em] text-primary/50">
              {String(activeIndex + 1).padStart(2, "0")}{" "}
              <span className="text-primary/25">/</span>{" "}
              {String(total).padStart(2, "0")}
            </p>
            <h3
              key={active.src}
              className="font-heading mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-4xl md:text-5xl animate-inspiration-title"
            >
              {active.eventName}
            </h3>
          </div>

          <div className="hidden flex-wrap gap-2 sm:flex sm:max-w-md sm:justify-end">
            {videos.map((video, index) => (
              <button
                key={video.src}
                type="button"
                onClick={() => goTo(index)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  index === activeIndex
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "border border-primary-border bg-white text-primary/80 hover:border-primary/30 hover:bg-primary-soft"
                }`}
                aria-current={index === activeIndex ? "true" : undefined}
              >
                {video.eventName}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-advance progress */}
        {!reduceMotion && total > 1 ? (
          <div className="mx-auto mt-6 h-0.5 max-w-5xl overflow-hidden rounded-full bg-primary-border/60">
            <div
              key={progressKey}
              className="h-full origin-left bg-gradient-to-r from-primary to-accent-gold animate-inspiration-progress"
              style={{ animationDuration: `${AUTO_MS}ms` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
