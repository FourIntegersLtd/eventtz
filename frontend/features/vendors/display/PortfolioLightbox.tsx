"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";

type PortfolioLightboxProps = {
  urls: string[];
  index: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function PortfolioLightbox({
  urls,
  index,
  alt,
  onClose,
  onIndexChange,
}: PortfolioLightboxProps) {
  const total = urls.length;
  const safeIndex = total > 0 ? Math.min(Math.max(index, 0), total - 1) : 0;
  const url = total > 0 ? urls[safeIndex] : null;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < total - 1;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && canPrev) {
        e.preventDefault();
        onIndexChange(safeIndex - 1);
      }
      if (e.key === "ArrowRight" && canNext) {
        e.preventDefault();
        onIndexChange(safeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, onClose, onIndexChange, safeIndex]);

  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[70] animate-ui-fade-in" role="dialog" aria-modal="true" aria-label={alt}>
      <button
        type="button"
        aria-label="Close gallery"
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="pointer-events-none max-h-full max-w-full object-contain"
          decoding="async"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 sm:right-5 sm:top-5 ${TOUCH_TARGET} ${FOCUS_RING}`}
        aria-label="Close"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      {total > 1 ? (
        <>
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onIndexChange(safeIndex - 1)}
            className={`absolute left-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-30 sm:left-4 ${TOUCH_TARGET} ${FOCUS_RING}`}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => onIndexChange(safeIndex + 1)}
            className={`absolute right-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-30 sm:right-4 ${TOUCH_TARGET} ${FOCUS_RING}`}
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2} />
          </button>
          <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            {safeIndex + 1} / {total}
          </p>
        </>
      ) : null}
    </div>
  );
}
