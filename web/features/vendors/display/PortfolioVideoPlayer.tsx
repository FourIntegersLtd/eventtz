"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type PortfolioVideoPlayerProps = {
  src: string;
  /** Accessible name for the player (not shown as a download link). */
  label?: string;
  className?: string;
  compact?: boolean;
  /** Pause in-feed autoplay (e.g. while the fullscreen lightbox is open). */
  suspendAutoplay?: boolean;
  onOpen?: () => void;
};

export function PortfolioVideoPlayer({
  src,
  label = "Portfolio video",
  className = "",
  compact = false,
  suspendAutoplay = false,
  onOpen,
}: PortfolioVideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.4));
      },
      { threshold: [0, 0.4, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (!inView || pausedByUser || suspendAutoplay) {
      el.pause();
      return;
    }
    if (reduceMotion) return;
    void el.play().catch(() => {});
  }, [inView, muted, pausedByUser, reduceMotion, src, suspendAutoplay]);

  const handleOpen = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    togglePlayback();
  };

  const togglePlayback = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      setPausedByUser(false);
      void el.play().catch(() => {});
      return;
    }
    setPausedByUser(true);
    el.pause();
  };

  const showPlayOverlay = !playing;

  return (
    <div
      ref={wrapRef}
      className={`group relative w-full overflow-hidden bg-neutral-950 md:inline-flex md:w-auto ${className}`.trim()}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className={`block h-auto w-full md:w-auto ${
          compact ? "max-h-24 md:max-h-24" : "md:max-h-80"
        }`}
      >
        Your browser does not support embedded video.
      </video>
      <button
        type="button"
        onClick={handleOpen}
        className={`absolute inset-0 flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset ${
          showPlayOverlay
            ? "bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            : "bg-transparent"
        }`}
        aria-label={onOpen ? `Open ${label} fullscreen` : playing ? `Pause ${label}` : `Play ${label}`}
      >
        {showPlayOverlay ? (
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-neutral-100 transition duration-300 group-hover:scale-[1.04]">
            <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMuted((prev) => !prev);
        }}
        className="absolute bottom-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={muted ? "Unmute video" : "Mute video"}
      >
        {muted ? (
          <VolumeX className="h-4 w-4" aria-hidden />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden />
        )}
      </button>
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/15"
        aria-hidden
      />
    </div>
  );
}
