import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_FEATURE_BODY_CLASS,
  LANDING_FEATURE_GAP,
  LANDING_FEATURE_HEADLINE_CLASS,
  landingFeatureSectionClass,
  type LandingSectionTone,
} from "@/features/landing/landingSectionStyles";

/** Wrapper for landing product screenshots (no border). */
export const LANDING_SCREENSHOT_FRAME_CLASS = "overflow-hidden";

type LandingFeatureSplitProps = {
  id?: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt: string;
  imageFallback?: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  /** Side-by-side or copy above full-width image. */
  variant?: "split" | "stacked";
  /** Intrinsic screenshot dimensions — defaults to 1920×1200 landing assets. */
  imageWidth?: number;
  imageHeight?: number;
  /** Image column first on large screens (split only). */
  imagePosition?: "left" | "right";
  /** Desktop marketing shot (wide) vs mobile screenshot (tall, narrow). */
  imageLayout?: "default" | "desktop-large" | "mobile";
  tone?: LandingSectionTone;
  sectionClassName?: string;
};

const GRID_CLASS = {
  default: {
    left: "lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]",
    right: "lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]",
  },
  "desktop-large": {
    left: "lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]",
    right: "lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]",
  },
  mobile: {
    left: "lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]",
    right: "lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]",
  },
} as const;

function LandingScreenshot({
  imageSrc,
  imageAlt,
  imageFallback,
  isMobileShot,
  priority,
  sizes,
  className = "",
  imageWidth = 1920,
  imageHeight = 1200,
}: {
  imageSrc?: string;
  imageAlt: string;
  imageFallback?: ReactNode;
  isMobileShot: boolean;
  priority?: boolean;
  sizes: string;
  className?: string;
  imageWidth?: number;
  imageHeight?: number;
}) {
  return (
    <div className={`${LANDING_SCREENSHOT_FRAME_CLASS} ${className}`.trim()}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={isMobileShot ? 900 : imageWidth}
          height={isMobileShot ? 1800 : imageHeight}
          className="block h-auto w-full max-w-none"
          sizes={sizes}
          priority={priority}
          unoptimized
        />
      ) : (
        <div className={isMobileShot ? "bg-white" : "bg-white"}>{imageFallback}</div>
      )}
    </div>
  );
}

/** Bold feature block: split (Cursor-style) or stacked (copy above full-width shot). */
export function LandingFeatureSplit({
  id,
  title,
  description,
  imageSrc,
  imageAlt,
  imageFallback,
  ctaHref,
  ctaLabel,
  variant = "split",
  imageWidth = 1920,
  imageHeight = 1200,
  imagePosition = "left",
  imageLayout = "default",
  tone = "white",
  sectionClassName,
}: LandingFeatureSplitProps) {
  const isMobileShot = imageLayout === "mobile";
  const isStacked = variant === "stacked";
  const resolvedSectionClass = sectionClassName ?? landingFeatureSectionClass(tone);

  const copyBlock = (
    <div className={`flex flex-col ${isStacked ? "max-w-2xl" : "min-w-0 justify-center"}`}>
      <h2 className={LANDING_FEATURE_HEADLINE_CLASS}>{title}</h2>
      <p className={LANDING_FEATURE_BODY_CLASS}>{description}</p>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80 sm:mt-8"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </Link>
      ) : null}
    </div>
  );

  if (isStacked) {
    return (
      <LandingSection id={id} className={resolvedSectionClass} width="7xl">
        <div className={`flex flex-col gap-6 sm:gap-8 lg:gap-12`}>
          {copyBlock}
          <div className="-mx-4 w-[calc(100%+2rem)] min-w-0 sm:mx-0 sm:w-full">
            <LandingScreenshot
              imageSrc={imageSrc}
              imageAlt={imageAlt}
              imageFallback={imageFallback}
              isMobileShot={isMobileShot}
              priority={id === "pricing-trust" || id === "book-request"}
              sizes="100vw"
              className="w-full"
              imageWidth={imageWidth}
              imageHeight={imageHeight}
            />
          </div>
        </div>
      </LandingSection>
    );
  }

  const imageBlock = (
    <div className="relative min-w-0">
      <LandingScreenshot
        imageSrc={imageSrc}
        imageAlt={imageAlt}
        imageFallback={imageFallback}
        isMobileShot={isMobileShot}
        priority={id === "pricing-trust" || id === "book-request" || id === "quote-accept"}
        sizes={isMobileShot ? "85vw" : "100vw"}
        className={isMobileShot ? "mx-auto w-full max-w-[20rem] sm:max-w-[22rem] lg:max-w-none" : "w-full"}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
      />
    </div>
  );

  const copyWithPadding = (
    <div
      className={`flex min-w-0 flex-col justify-center ${
        imagePosition === "left" ? "lg:pl-4 xl:pl-6" : "lg:pr-4 xl:pr-6"
      }`}
    >
      {copyBlock}
    </div>
  );

  const gridLayoutKey = imageLayout === "default" ? "default" : imageLayout;
  const gridColsClass =
    GRID_CLASS[gridLayoutKey][imagePosition === "right" ? "right" : "left"];

  return (
    <LandingSection id={id} className={resolvedSectionClass} width="7xl">
      <div
        className={`grid items-center ${gridColsClass} ${LANDING_FEATURE_GAP} ${
          imagePosition === "right" ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        {imageBlock}
        {copyWithPadding}
      </div>
    </LandingSection>
  );
}
