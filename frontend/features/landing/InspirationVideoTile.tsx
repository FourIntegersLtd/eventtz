"use client";

import { useEffect, useRef } from "react";
import { LandingVideo } from "@/components/media/LandingVideo";
import type { GalleryVideo } from "@/features/landing/landingData";

type InspirationVideoTileProps = {
  video: GalleryVideo;
  isActive?: boolean;
  shouldLoad?: boolean;
  className?: string;
  onClick?: () => void;
  /** Hide on-tile title when the showcase renders it externally. */
  showTitle?: boolean;
};

export function InspirationVideoTile({
  video,
  isActive = false,
  shouldLoad = false,
  className = "",
  onClick,
  showTitle = true,
}: InspirationVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !shouldLoad) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncPlayback = () => {
      if (!isActive || motionQuery.matches) {
        el.pause();
        return;
      }
      el.muted = true;
      void el.play().catch(() => {});
    };

    syncPlayback();
    el.addEventListener("canplay", syncPlayback);
    el.addEventListener("loadeddata", syncPlayback);

    return () => {
      el.removeEventListener("canplay", syncPlayback);
      el.removeEventListener("loadeddata", syncPlayback);
    };
  }, [isActive, shouldLoad, video.src]);

  const content = (
    <>
      <LandingVideo
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition duration-[900ms] ${
          isActive ? "scale-100" : "scale-110 blur-[2px] group-hover:scale-105 group-hover:blur-0"
        }`}
        muted
        loop
        playsInline
        preload={isActive ? "auto" : "metadata"}
        src={shouldLoad ? video.src : undefined}
        aria-hidden
      />
      <div
        className={`absolute inset-0 transition duration-700 ${
          isActive
            ? "bg-gradient-to-t from-black/80 via-black/20 to-black/10"
            : "bg-black/45 group-hover:bg-black/30"
        }`}
        aria-hidden
      />
      {isActive ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-accent-gold to-transparent opacity-90"
            aria-hidden
          />
        </>
      ) : null}
      {showTitle && isActive ? (
        <p className="absolute bottom-6 left-6 max-w-[85%] font-heading text-3xl font-semibold leading-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">
          {video.eventName}
        </p>
      ) : null}
    </>
  );

  const sharedClass = `group relative block w-full overflow-hidden bg-neutral-950 text-left ${className}`.trim();

  if (isActive && !onClick) {
    return (
      <div className={sharedClass} aria-label={video.eventName}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sharedClass} cursor-pointer`}
      aria-label={video.eventName}
      aria-pressed={isActive}
    >
      {content}
    </button>
  );
}
