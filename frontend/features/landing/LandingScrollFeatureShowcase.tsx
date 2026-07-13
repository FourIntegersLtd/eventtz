"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LANDING_SCREENSHOT_FRAME_CLASS } from "@/features/landing/LandingFeatureSplit";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SCREENSHOT_DEFAULT_HEIGHT,
  LANDING_SCREENSHOT_DEFAULT_WIDTH,
  LANDING_SPLIT_SCREENSHOT_SIZES,
} from "@/features/landing/landingScreenshotConfig";
import {
  LANDING_FEATURE_BODY_CLASS,
  LANDING_FEATURE_HEADLINE_CLASS,
  landingFeatureSectionClass,
  LANDING_SECTION_BG,
  type LandingSectionTone,
} from "@/features/landing/landingSectionStyles";
import type { LandingScrollFeatureStep } from "@/features/landing/landingData";
import { useLandingScrollSpy } from "@/features/landing/useLandingScrollSpy";

type LandingScrollFeatureShowcaseProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description: string;
  summary?: string;
  steps: LandingScrollFeatureStep[];
  imageFallbacks?: Partial<Record<string, ReactNode>>;
  tablistAriaLabel?: string;
  tone?: LandingSectionTone;
};

function StepScreenshot({
  step,
  fallback,
  visible,
  priority,
}: {
  step: LandingScrollFeatureStep;
  fallback?: ReactNode;
  visible: boolean;
  priority?: boolean;
}) {
  const frame = (
    <div className="h-full w-full">
      {step.imageSrc ? (
        <Image
          src={step.imageSrc}
          alt={step.imageAlt}
          width={LANDING_SCREENSHOT_DEFAULT_WIDTH}
          height={LANDING_SCREENSHOT_DEFAULT_HEIGHT}
          className="block h-auto w-full"
          sizes={LANDING_SPLIT_SCREENSHOT_SIZES}
          priority={priority}
          unoptimized
        />
      ) : (
        <div className="bg-white">{fallback}</div>
      )}
    </div>
  );

  return (
    <div
      className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        visible
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-3 scale-[0.985] opacity-0"
      }`}
      aria-hidden={!visible}
    >
      {frame}
    </div>
  );
}

/** KnowHow-style sticky image + scrolling copy; image crossfades per step. */
export function LandingScrollFeatureShowcase({
  id,
  eyebrow,
  title,
  description,
  summary,
  steps,
  imageFallbacks,
  tablistAriaLabel = "Journey steps",
  tone = "white",
}: LandingScrollFeatureShowcaseProps) {
  const { activeIndex, setStepRef, scrollToStep } = useLandingScrollSpy(steps.length);

  const activeStepId = steps[activeIndex]?.id ?? steps[0]?.id;
  const stickyBarBg = `${LANDING_SECTION_BG[tone]}/95`;
  const sectionCta = steps.find((step) => step.ctaHref && step.ctaLabel);

  return (
    <LandingSection id={id} className={landingFeatureSectionClass(tone)} width="7xl">
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h2 className={`${LANDING_FEATURE_HEADLINE_CLASS} ${eyebrow ? "mt-2.5" : ""}`}>{title}</h2>
        <p className={LANDING_FEATURE_BODY_CLASS}>{description}</p>
      </div>

      <div
        className={`sticky top-[4.25rem] z-30 mt-6 flex justify-center py-3 backdrop-blur-md sm:mt-8 ${stickyBarBg}`}
      >
        <div
          className="flex w-full max-w-lg items-center rounded-full bg-neutral-100 p-1 ring-1 ring-neutral-200/90"
          role="tablist"
          aria-label={tablistAriaLabel}
        >
          {steps.map((step, index) => {
            const active = activeStepId === step.id;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={step.id}
                onClick={() => scrollToStep(index)}
                className={`flex-1 rounded-full px-2 py-2.5 text-center text-sm font-semibold transition-all duration-300 motion-reduce:transition-none sm:px-4 ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-neutral-600 hover:text-primary"
                }`}
              >
                {step.stepLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-8 xl:gap-10">
        <div className="relative hidden lg:block">
          <div className="sticky top-[7.5rem] flex min-h-[calc(100dvh-7.5rem)] w-full items-center">
            <div className={`relative aspect-[16/10] w-full ${LANDING_SCREENSHOT_FRAME_CLASS}`}>
              {steps.map((step, index) => (
                <StepScreenshot
                  key={step.id}
                  step={step}
                  fallback={imageFallbacks?.[step.id]}
                  visible={activeIndex === index}
                  priority={index === 0}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-0">
          {steps.map((step, index) => {
            const active = activeIndex === index;
            return (
              <article
                key={step.id}
                id={step.id}
                ref={setStepRef(index)}
                className="flex flex-col justify-center border-t border-neutral-200/80 py-8 first:border-t-0 first:pt-4 sm:py-10 lg:min-h-[calc(100dvh-7.5rem)] lg:py-0"
                aria-current={active ? "step" : undefined}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-500 ${
                    active ? "text-primary" : "text-neutral-400"
                  }`}
                >
                  {step.stepLabel}
                </p>
                <h3
                  className={`font-heading mt-3 text-2xl font-semibold leading-tight tracking-tight transition-colors duration-500 sm:text-3xl ${
                    active ? "text-primary" : "text-neutral-800"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg sm:leading-8">
                  {step.description}
                </p>

                {step.quote ? (
                  <blockquote className="mt-6 border-l-2 border-primary/25 pl-4 text-sm italic leading-relaxed text-neutral-500 sm:text-base">
                    &ldquo;{step.quote}&rdquo;
                  </blockquote>
                ) : null}

                {step.ctaHref && step.ctaLabel ? (
                  <Link
                    href={step.ctaHref}
                    className="mt-8 hidden w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80 lg:inline-flex"
                  >
                    {step.ctaLabel}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      {summary ? (
        <p className="mx-auto mt-10 max-w-2xl border-t border-neutral-200/80 pt-8 text-center text-sm leading-relaxed text-neutral-500 sm:text-base">
          {summary}
        </p>
      ) : null}

      {sectionCta ? (
        <div className={`flex justify-center lg:hidden ${summary ? "mt-6" : "mt-10 border-t border-neutral-200/80 pt-8"}`}>
          <Link
            href={sectionCta.ctaHref!}
            className="inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80"
          >
            {sectionCta.ctaLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      ) : null}
    </LandingSection>
  );
}
