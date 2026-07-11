"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GALLERY_IMAGES } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";

export function LandingPopularCarousel() {
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % GALLERY_IMAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="popular"
      className="relative flex min-h-0 flex-col justify-center border-t border-primary-border/50 bg-neutral-50 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        <LandingSectionHeading eyebrow="Real events" title="Popular on Eventtz" />
        <div className="mx-auto mt-8 w-full max-h-[50vh] aspect-[4/3] sm:mt-10 sm:max-h-[58vh]">
          <div className="h-full overflow-hidden rounded-2xl">
            <div
              className="flex h-full transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(${(12.5 - 75 * carouselIndex) / 3}%)`,
                width: `${GALLERY_IMAGES.length * 75}%`,
              }}
            >
              {GALLERY_IMAGES.map((img, i) => {
                const n = GALLERY_IMAGES.length;
                const isLeftNeighbor = i === (carouselIndex - 1 + n) % n;
                const isRightNeighbor = i === (carouselIndex + 1) % n;
                const isSideImage = isLeftNeighbor || isRightNeighbor;
                return (
                  <div
                    key={i}
                    className={`flex h-full shrink-0 items-center transition-all duration-300 ${
                      isSideImage ? "opacity-90" : ""
                    }`}
                    style={{
                      width: `${100 / GALLERY_IMAGES.length}%`,
                      paddingLeft: "0.5rem",
                      paddingRight: "0.5rem",
                    }}
                  >
                    <div className="flex h-full w-full flex-col gap-2">
                      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-sm ring-1 ring-neutral-200">
                        <Image
                          src={img.src}
                          alt={img.alt}
                          fill
                          className={`object-cover object-center transition-all duration-300 ${
                            isSideImage ? "blur-[8px] scale-105" : ""
                          }`}
                          sizes="(max-width: 1152px) 100vw, 1152px"
                          unoptimized
                        />
                      </div>
                      <p className="text-center text-sm font-medium text-neutral-700 sm:text-base">
                        {img.eventName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 pb-2 sm:mt-8 sm:gap-8 sm:pb-4">
            <button
              type="button"
              onClick={() =>
                setCarouselIndex((i) => (i === 0 ? GALLERY_IMAGES.length - 1 : i - 1))
              }
              aria-label="Previous slide"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-50"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <div className="flex items-center justify-center gap-2">
              {GALLERY_IMAGES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <span
                    className={`block rounded-full transition-all ${
                      i === carouselIndex
                        ? "h-2.5 w-7 bg-primary"
                        : "h-2.5 w-2.5 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setCarouselIndex((i) => (i === GALLERY_IMAGES.length - 1 ? 0 : i + 1))
              }
              aria-label="Next slide"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-50"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
