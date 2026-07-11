"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { HeroMarketplaceSearch } from "@/features/marketplace/HeroMarketplaceSearch";
import {
  HERO_QUICK_LINKS,
  HERO_VIDEO_POSTER,
  HERO_VIDEO_SRC,
} from "@/features/landing/landingData";

export function LandingHero() {
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [heroVideoPaused, setHeroVideoPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const v = heroVideoRef.current;
      if (!v) return;
      if (mq.matches) {
        v.pause();
        setHeroVideoPaused(true);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const toggleHeroVideo = () => {
    const v = heroVideoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setHeroVideoPaused(false);
    } else {
      v.pause();
      setHeroVideoPaused(true);
    }
  };

  return (
    <section className="relative z-0 isolate flex min-h-[92vh] flex-col justify-end pb-16 pt-28 sm:min-h-[min(100vh,900px)] sm:justify-center sm:pb-20 sm:pt-24">
      <div className="absolute inset-0 z-0 bg-neutral-950">
        <video
          ref={heroVideoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_VIDEO_POSTER}
          onLoadedData={(e) => {
            const v = e.currentTarget;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              v.pause();
              setHeroVideoPaused(true);
            }
          }}
          onPlay={() => setHeroVideoPaused(false)}
          onPause={() => setHeroVideoPaused(true)}
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-neutral-950/25" aria-hidden />
        <div className="absolute inset-0 bg-primary/20" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/65"
          aria-hidden
        />
      </div>

      <button
        type="button"
        onClick={toggleHeroVideo}
        className="absolute bottom-6 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 sm:bottom-10 sm:right-8"
        aria-label={heroVideoPaused ? "Play background video" : "Pause background video"}
      >
        {heroVideoPaused ? (
          <Play className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Pause className="h-5 w-5" strokeWidth={2} />
        )}
      </button>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl text-left">
          <h1 className="font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl">
            Book <span className="text-accent-gold">African</span> event vendors in the UK.
          </h1>
          <p className="mt-4 max-w-lg text-base font-medium text-white/90 sm:text-lg">
            Search by service and city.{" "}
            <span className="text-violet-200">Message and book</span> in one place.
          </p>
        </div>

        <div className="mt-8 w-full max-w-4xl">
          <HeroMarketplaceSearch variant="landing" submitToPath="/client/browse" />
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-gold/75">
            Popular
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {HERO_QUICK_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:border-primary/45 hover:bg-primary/25"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
