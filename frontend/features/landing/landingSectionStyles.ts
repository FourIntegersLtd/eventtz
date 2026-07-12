/** Shared vertical rhythm and surfaces for the marketing landing page. */

export const LANDING_SECTION_BORDER = "border-t border-primary-border/50";

/** Standard section padding — use on most content blocks. */
export const LANDING_SECTION_PY = "py-16 sm:py-20 md:py-24";

/** Screenshot / feature sections — same vertical scale as standard sections. */
export const LANDING_FEATURE_PY = LANDING_SECTION_PY;

/** Compact strip below hero (categories browse). */
export const LANDING_STRIP_PY = "pt-10 pb-14 sm:pt-12 sm:pb-16";

export const LANDING_SECTION_BG = {
  white: "bg-white",
  muted: "bg-page-bg",
  soft: "bg-primary-soft/25",
  neutral: "bg-neutral-50",
} as const;

export type LandingSectionTone = keyof typeof LANDING_SECTION_BG;

export function landingSectionClass(tone: LandingSectionTone, extra = ""): string {
  return [LANDING_SECTION_BORDER, LANDING_SECTION_BG[tone], LANDING_SECTION_PY, extra]
    .filter(Boolean)
    .join(" ");
}

export function landingFeatureSectionClass(tone: LandingSectionTone): string {
  return [LANDING_SECTION_BORDER, LANDING_SECTION_BG[tone], LANDING_FEATURE_PY].join(" ");
}

/** Inner gap between section heading and primary content. */
export const LANDING_SECTION_CONTENT_MT = "mt-10 sm:mt-12 lg:mt-14";

/** Secondary gap within a section (e.g. tabs → grid below). */
export const LANDING_SECTION_STACK_MT = "mt-8 sm:mt-10";

/** Feature split / stacked inner spacing. */
export const LANDING_FEATURE_GAP = "gap-8 sm:gap-10 lg:gap-12";

export const LANDING_FEATURE_HEADLINE_CLASS =
  "font-heading text-2xl font-semibold leading-[1.15] tracking-tight text-primary sm:text-3xl md:text-4xl lg:text-[2.35rem] xl:text-[2.65rem]";

export const LANDING_FEATURE_BODY_CLASS =
  "mt-3 text-sm leading-relaxed text-neutral-600 sm:mt-4 sm:text-base md:mt-5 md:text-lg md:leading-8";
