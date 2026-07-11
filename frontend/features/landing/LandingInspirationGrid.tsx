"use client";

import Image from "next/image";
import { GALLERY_IMAGES } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingInspirationGrid() {
  const [hero, ...rest] = GALLERY_IMAGES;

  return (
    <LandingSection
      id="inspiration"
      className="hidden border-t border-primary-border/50 bg-primary-soft py-16 sm:py-20 md:block md:py-24"
      width="6xl"
    >
      <LandingSectionHeading eyebrow="Inspiration" title="Every kind of event" />

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:grid-rows-2 md:gap-5">
        {hero ? (
          <article className="relative col-span-2 row-span-2 min-h-[220px] overflow-hidden rounded-3xl sm:min-h-[280px] md:min-h-[360px]">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              className="object-cover transition duration-500 hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={80}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <p className="absolute bottom-4 left-4 font-heading text-lg font-semibold text-accent-gold sm:text-xl">
              {hero.eventName}
            </p>
          </article>
        ) : null}

        {rest.map((img) => (
          <article
            key={img.src}
            className="relative min-h-[140px] overflow-hidden rounded-2xl sm:min-h-[160px] md:min-h-[172px]"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              className="object-cover transition duration-500 hover:scale-[1.02]"
              sizes="(max-width: 768px) 50vw, 25vw"
              quality={80}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
            <p className="absolute bottom-3 left-3 text-sm font-semibold text-violet-200">{img.eventName}</p>
          </article>
        ))}
      </div>
    </LandingSection>
  );
}
