"use client";

import { useEffect, useRef } from "react";
import type { GalleryVideo } from "@/features/landing/landingData";

type InspirationMobileReelProps = {
  video: GalleryVideo;
  inView: boolean;
  reduceMotion: boolean;
  className?: string;
};

/**
 * One &lt;video&gt; for the celebrations carousel on small screens.
 * Chrome on iPhone uses WebKit and blacks out if several clips are decoded
 * (including display:none / opacity:0 neighbours). Swap src by remounting.
 */
export function InspirationMobileReel({
  video,
  inView,
  reduceMotion,
  className = "",
}: InspirationMobileReelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");

    if (!inView || reduceMotion) {
      el.pause();
      return;
    }

    const tryPlay = () => {
      el.muted = true;
      void el.play().catch(() => {});
    };

    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("canplay", tryPlay);
    el.addEventListener("playing", tryPlay);
    return () => {
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      el.removeEventListener("playing", tryPlay);
      el.pause();
    };
  }, [inView, reduceMotion, video.src]);

  return (
    <div
      className={`relative overflow-hidden bg-neutral-950 ${className}`.trim()}
      aria-label={video.eventName}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={inView ? video.src : undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-accent-gold to-transparent opacity-90"
        aria-hidden
      />
    </div>
  );
}
