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
 * One persistent &lt;video&gt; for the celebrations carousel on small screens.
 * Keep a single element and swap src — remounting on each slide makes iOS block
 * muted autoplay on later clips. One element avoids WebKit blacking out when
 * several decoded clips sit in the DOM (display:none neighbours).
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

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled) return;
      el.muted = true;
      void el.play().catch(() => {});
    };

    // Reuse one <video> and swap src. Remounting a new element on each slide
    // makes iOS treat later clips as fresh media and block muted autoplay.
    el.load();
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      tryPlay();
    } else {
      el.addEventListener("loadeddata", tryPlay);
      el.addEventListener("canplay", tryPlay);
    }

    return () => {
      cancelled = true;
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      el.pause();
    };
  }, [inView, reduceMotion, video.src]);

  return (
    <div
      className={`relative overflow-hidden bg-ink ${className}`.trim()}
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
