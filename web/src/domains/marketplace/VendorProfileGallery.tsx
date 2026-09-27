"use client";

/**
 * Portfolio collage for the vendor profile.
 * Up to three photos in a grid, a lightbox for the rest, and plain links for videos.
 * The baseline video player needs a package this workstream cannot add.
 */
import { useState } from "react";

type VendorProfileGalleryProps = {
  urls: string[];
  videoUrls: string[];
  alt: string;
  emptyFallback: string;
  bookmarked: boolean;
  onToggleBookmark: () => void;
};

/** Gallery, save button, and portfolio video links. */
export function VendorProfileGallery({
  urls,
  videoUrls,
  alt,
  emptyFallback,
  bookmarked,
  onToggleBookmark,
}: VendorProfileGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const hero = urls[0];
  const second = urls[1];
  const third = urls[2];

  return (
    <div className="min-w-0">
      {urls.length === 0 ? (
        <div className="relative flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-100 via-white to-neutral-50">
          <span className="font-heading text-4xl font-semibold tracking-tight text-neutral-300 sm:text-5xl">
            {emptyFallback.slice(0, 1).toUpperCase() || "?"}
          </span>
          <BookmarkButton bookmarked={bookmarked} onToggle={onToggleBookmark} />
        </div>
      ) : (
        <div className="relative grid gap-1 overflow-hidden rounded-2xl md:aspect-[16/10] md:grid-cols-[1.35fr_1fr] md:grid-rows-2">
          {hero ? (
            <GalleryPhoto
              url={hero}
              alt={`${alt} 1`}
              className={second ? "aspect-[4/3] md:col-start-1 md:row-span-2 md:aspect-auto md:h-full" : "aspect-[16/10] md:col-span-2 md:row-span-2"}
              onOpen={() => setOpenIndex(0)}
            />
          ) : null}
          {second ? (
            <GalleryPhoto
              url={second}
              alt={`${alt} 2`}
              className="aspect-[4/3] md:col-start-2 md:row-start-1 md:aspect-auto md:h-full"
              onOpen={() => setOpenIndex(1)}
            />
          ) : null}
          {third ? (
            <GalleryPhoto
              url={third}
              alt={`${alt} 3`}
              className="aspect-[4/3] md:col-start-2 md:row-start-2 md:aspect-auto md:h-full"
              onOpen={() => setOpenIndex(2)}
              label={urls.length > 3 ? `View gallery (${urls.length})` : "View gallery"}
            />
          ) : null}
          <BookmarkButton bookmarked={bookmarked} onToggle={onToggleBookmark} />
        </div>
      )}

      {videoUrls.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {videoUrls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                Watch portfolio video
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {openIndex != null && urls[openIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div role="dialog" aria-modal="true" aria-label={`${alt} gallery`} className="relative w-full max-w-4xl">
            {/* Portfolio URLs are already public S3 links; next/image would need a remote pattern per bucket. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[openIndex]} alt={`${alt} ${openIndex + 1}`} className="max-h-[80vh] w-full object-contain" />
            <div className="mt-3 flex items-center justify-between text-sm text-white">
              <button
                type="button"
                disabled={openIndex <= 0}
                onClick={() => setOpenIndex(openIndex - 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                {openIndex + 1} / {urls.length}
              </span>
              <button
                type="button"
                disabled={openIndex >= urls.length - 1}
                onClick={() => setOpenIndex(openIndex + 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="absolute right-2 top-2 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalleryPhoto({
  url,
  alt,
  className,
  onOpen,
  label,
}: {
  url: string;
  alt: string;
  className: string;
  onOpen: () => void;
  label?: string;
}) {
  return (
    <button type="button" onClick={onOpen} className={`relative block min-h-0 overflow-hidden bg-neutral-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-full w-full object-cover object-top" />
      {label ? (
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white">
          {label}
        </span>
      ) : null}
    </button>
  );
}

function BookmarkButton({ bookmarked, onToggle }: { bookmarked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={bookmarked ? "Remove from saved" : "Save"}
      aria-pressed={bookmarked}
      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg text-neutral-600 backdrop-blur-sm transition hover:bg-white hover:text-red-500"
    >
      <span aria-hidden>{bookmarked ? "\u2665" : "\u2661"}</span>
    </button>
  );
}
