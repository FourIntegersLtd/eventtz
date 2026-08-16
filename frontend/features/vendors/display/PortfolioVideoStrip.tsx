"use client";

import { useState } from "react";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";
import { PortfolioVideoPlayer } from "@/features/vendors/display/PortfolioVideoPlayer";

export type PortfolioVideoStripItem = {
  src: string;
  label?: string;
};

type PortfolioVideoStripProps = {
  videos: readonly PortfolioVideoStripItem[];
  compact?: boolean;
  className?: string;
};

export function PortfolioVideoStrip({
  videos,
  compact = false,
  className = "",
}: PortfolioVideoStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (videos.length === 0) return null;

  const pairOnMobile = videos.length > 1;
  const urls = videos.map((video) => video.src);

  return (
    <>
      <div
        className={`flex snap-x snap-mandatory items-start overflow-x-auto ${className}`.trim()}
      >
        {videos.map((video, index) => (
          <div
            key={video.src}
            className={`shrink-0 snap-start ${
              pairOnMobile ? "w-1/2 md:w-auto" : "w-full md:w-auto"
            }`}
          >
            <PortfolioVideoPlayer
              src={video.src}
              compact={compact}
              suspendAutoplay={lightboxIndex != null}
              onOpen={() => setLightboxIndex(index)}
              label={
                video.label ??
                (videos.length > 1 ? `Portfolio video ${index + 1}` : "Portfolio video")
              }
            />
          </div>
        ))}
      </div>
      {lightboxIndex != null ? (
        <PortfolioLightbox
          kind="video"
          urls={urls}
          index={lightboxIndex}
          alt="Portfolio video"
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}
