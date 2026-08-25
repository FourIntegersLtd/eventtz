"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LandingScreenshotFrame } from "@/features/landing/LandingScreenshotFrame";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SCREENSHOT_DEFAULT_HEIGHT,
  LANDING_SCREENSHOT_DEFAULT_WIDTH,
  LANDING_SCREENSHOT_NATURAL_CLASS,
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
  description?: string;
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
  layout = "stacked",
}: {
  step: LandingScrollFeatureStep;
  fallback?: ReactNode;
  visible: boolean;
  priority?: boolean;
  layout?: "stacked" | "inline";
}) {
  const imageClassName =
    layout === "inline"
      ? LANDING_SCREENSHOT_NATURAL_CLASS
      : "h-full w-full object-contain object-top";

  const frame = (
    <div
      className={
        layout === "inline"
          ? "w-full leading-[0]"
          : "h-full w-full leading-[0]"
      }
    >
      {step.imageSrc ? (
        <Image
          src={step.imageSrc}
          alt={step.imageAlt}
          width={LANDING_SCREENSHOT_DEFAULT_WIDTH}
          height={LANDING_SCREENSHOT_DEFAULT_HEIGHT}
          className={imageClassName}
          sizes={LANDING_SPLIT_SCREENSHOT_SIZES}
          priority={priority}
          unoptimized
        />
      ) : (
        fallback
      )}
    </div>
  );

  if (layout === "inline") {
    return frame;
  }

  return (
    <div
      className={`absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        visible
          ? "z-10 pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "z-0 pointer-events-none invisible translate-y-3 scale-[0.985] opacity-0"
      }`}
      aria-hidden={!visible}
    >
      {frame}
    </div>
  );
}

function MobileJourneyStepCard({
  step,
  index,
  fallback,
}: {
  step: LandingScrollFeatureStep;
  index: number;
  fallback?: ReactNode;
}) {
  const StepIcon = step.Icon;

  return (
    <article
      id={step.id}
      className="flex flex-col rounded-2xl border border-primary-border/60 bg-white p-5 shadow-sm sm:p-6"
    >
      <span className="font-heading text-sm font-semibold tabular-nums text-accent-gold">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        <StepIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        {step.stepLabel}
      </p>
      <h3 className="font-heading mt-2 text-lg font-semibold text-primary sm:text-xl">{step.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 sm:text-[15px] sm:leading-7">
        {step.description}
      </p>
      <div className="mt-5">
        <LandingScreenshotFrame
          imageSrc={step.imageSrc}
          imageAlt={step.imageAlt}
          fallback={fallback}
          variant="marketing"
          className="shadow-md"
        />
      </div>
    </article>
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
      <div className="mx-auto max-w-5xl text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h2 className={`${LANDING_FEATURE_HEADLINE_CLASS} text-balance ${eyebrow ? "mt-2.5" : ""}`}>
          {title}
        </h2>
        {description ? (
          <p className={`${LANDING_FEATURE_BODY_CLASS} mx-auto hidden max-w-3xl text-pretty md:block`}>
            {description}
          </p>
        ) : null}
      </div>

      <div
        className={`z-30 mt-6 hidden justify-center py-2 sm:mt-8 lg:flex lg:sticky lg:top-[4.25rem] lg:py-3 lg:backdrop-blur-md ${stickyBarBg}`}
      >
        <div
          className="flex w-full max-w-none items-center rounded-full bg-neutral-100 p-1 ring-1 ring-neutral-200/90 sm:max-w-lg"
          role="tablist"
          aria-label={tablistAriaLabel}
        >
          {steps.map((step, index) => {
            const active = activeStepId === step.id;
            const StepIcon = step.Icon;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={step.id}
                onClick={() => scrollToStep(index)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full px-2 py-2.5 text-center text-[11px] font-semibold transition-all duration-300 motion-reduce:transition-none sm:min-h-0 sm:gap-1.5 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-neutral-600 hover:text-primary"
                }`}
              >
                <StepIcon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{step.stepLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-5 sm:space-y-6 lg:hidden">
        {steps.map((step, index) => (
          <MobileJourneyStepCard
            key={step.id}
            step={step}
            index={index}
            fallback={imageFallbacks?.[step.id]}
          />
        ))}
      </div>

      <div className="mt-4 hidden lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-8 xl:gap-10">
        <div className="relative hidden lg:block">
          <div className="sticky top-[7.5rem] flex min-h-[calc(100dvh-7.5rem)] w-full items-center">
            <div className="relative aspect-[16/10] w-full">
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
            const StepIcon = step.Icon;
            return (
              <article
                key={step.id}
                ref={setStepRef(index)}
                className="flex flex-col justify-center border-t border-neutral-200/80 py-6 first:border-t-0 first:pt-4 sm:py-10 lg:min-h-[calc(100dvh-7.5rem)] lg:py-0"
                aria-current={active ? "step" : undefined}
              >
                <p
                  className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-500 ${
                    active ? "text-primary" : "text-neutral-400"
                  }`}
                >
                  <StepIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
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

                {step.ctaHref && step.ctaLabel ? (
                  <Link
                    href={step.ctaHref}
                    className="mt-8 inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition hover:opacity-80"
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
