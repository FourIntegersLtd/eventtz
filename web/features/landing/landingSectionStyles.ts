/** Shared vertical rhythm and surfaces for the marketing landing page. */

/*
 * Fixed landing nav height, measured in the browser (not guessed): 69px (4.3125rem) below `sm`,
 * 65px (4.0625rem) from `sm` up. Tailwind needs whole class strings, so each offset below is a
 * literal; change them together if the nav padding or logo size changes.
 */

/** Top padding that clears the fixed landing nav (page content wrappers). */
export const LANDING_NAV_OFFSET_CLASS = "pt-[4.3125rem] sm:pt-[4.0625rem]";

/** Top of the mobile menu panel, directly under the nav (below the safe-area inset). */
export const LANDING_NAV_MENU_TOP_CLASS =
  "top-[calc(env(safe-area-inset-top)+4.3125rem)] sm:top-[calc(env(safe-area-inset-top)+4.0625rem)]";

/** Scroll margin for anchored targets: nav height plus 1rem of air. */
export const LANDING_SCROLL_MT_CLASS = "scroll-mt-[5.3125rem] sm:scroll-mt-[5.0625rem]";

/**
 * Same scroll margin applied to every descendant with an id (legal prose headings and sections).
 * Keep in step with LANDING_SCROLL_MT_CLASS and `ACTIVE_LINE_OFFSET_PX` in useComplianceSections.ts.
 */
export const LANDING_SCROLL_MT_DESCENDANTS_CLASS =
  "[&_[id]]:scroll-mt-[5.3125rem] sm:[&_[id]]:scroll-mt-[5.0625rem]";

/** Sticky `top` for desktop bars that pin directly under the nav. */
export const LANDING_NAV_STICKY_TOP_CLASS = "lg:top-[4.0625rem]";

/** Sticky `top` for desktop sidebars that pin under the nav with 1.5rem of air. */
export const LANDING_NAV_STICKY_ASIDE_TOP_CLASS = "lg:top-[6.0625rem]";

/** Sticky `top` for the showcase stage: nav plus the 3.25rem tab bar. */
export const LANDING_SHOWCASE_STICKY_TOP_CLASS = "top-[7.3125rem]";

/** Showcase stage and step minimum height: the viewport below the nav and tab bar. */
export const LANDING_SHOWCASE_MIN_H_CLASS = "min-h-[calc(100dvh-7.3125rem)]";

/** Same minimum height, applied from `lg` up only. */
export const LANDING_SHOWCASE_MIN_H_LG_CLASS = "lg:min-h-[calc(100dvh-7.3125rem)]";

/** Horizontal gutters shared across landing nav, hero, and sections. */
export const LANDING_HORIZONTAL_PADDING = "px-4 sm:px-6 lg:px-12";

/** Primary landing content width - keep nav, hero, and sections on the same vertical grid. */
export const LANDING_PAGE_MAX_WIDTH = "max-w-[90rem]";

/** Horizontal alignment for nav, hero, and primary landing content. */
export const LANDING_PAGE_CONTAINER_CLASS =
  `mx-auto w-full ${LANDING_PAGE_MAX_WIDTH} ${LANDING_HORIZONTAL_PADDING}`;

/** Hero can breathe a little more on large screens than compact strips. */
export const LANDING_HERO_CONTAINER_CLASS =
  `mx-auto w-full max-w-[90rem] ${LANDING_HORIZONTAL_PADDING}`;

export const LANDING_SECTION_BORDER = "border-t border-line";

/**
 * Viewport-tiered section shells (prefer `min-h-dvh`, never force exact `h-dvh`):
 * - **full** - one story per screen (hero)
 * - **near** - story sections on desktop; natural height on mobile
 * - **content** - dense blocks (discover, grids, FAQ); generous padding only
 */
export type LandingSectionShell = "full" | "near" | "content";

export const LANDING_SECTION_SHELL = {
  full: "relative flex min-h-dvh flex-col",
  /** Desktop: fill the viewport and center the story block; mobile: natural height. */
  near: "relative flex min-h-0 flex-col justify-center lg:min-h-dvh",
  content: "relative",
} as const;

/** Padding inside shells - content is the most common. */
export const LANDING_SECTION_SHELL_PY = {
  full: "py-16 sm:py-20 lg:py-24",
  near: "py-20 sm:py-24 lg:py-28",
  content: "py-20 sm:py-24 md:py-28",
} as const;

/** @deprecated Prefer `LANDING_SECTION_SHELL_PY.content` via `landingSectionClass`. */
export const LANDING_SECTION_PY = LANDING_SECTION_SHELL_PY.content;

/** Screenshot / feature sections - same vertical scale as standard sections. */
export const LANDING_FEATURE_PY = LANDING_SECTION_SHELL_PY.content;

/** Compact strip below hero (categories browse). */
export const LANDING_STRIP_PY = "pt-10 pb-14 sm:pt-12 sm:pb-16";

export const LANDING_SECTION_BG = {
  white: "bg-white",
  muted: "bg-page-bg",
  soft: "bg-surface-3",
  /** Solid brand band (white text, gold accents); use for at most one or two sections. */
  brand: "bg-primary",
} as const;

export type LandingSectionTone = keyof typeof LANDING_SECTION_BG;

type LandingSectionClassOptions = {
  shell?: LandingSectionShell;
  /** When false, omit the top hairline (e.g. first band after nav). Default true. */
  bordered?: boolean;
  extra?: string;
};

/**
 * Shared landing section surface.
 * Pass a string as the 2nd arg for legacy `extra` classes, or an options object.
 */
export function landingSectionClass(
  tone: LandingSectionTone,
  options: LandingSectionClassOptions | string = {},
): string {
  const opts: LandingSectionClassOptions =
    typeof options === "string" ? { extra: options } : options;
  const shell = opts.shell ?? "content";
  const bordered = opts.bordered !== false;

  return [
    bordered ? LANDING_SECTION_BORDER : "",
    LANDING_SECTION_BG[tone],
    LANDING_SECTION_SHELL[shell],
    LANDING_SECTION_SHELL_PY[shell],
    opts.extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function landingFeatureSectionClass(tone: LandingSectionTone, extra = ""): string {
  /** Scroll/feature showcases grow past one screen - use content shell, not near. */
  return landingSectionClass(tone, { shell: "content", extra });
}

/** Inner gap between section heading and primary content. */
export const LANDING_SECTION_CONTENT_MT = "mt-10 sm:mt-12 lg:mt-14";

/** Secondary gap within a section (e.g. tabs → grid below). */
export const LANDING_SECTION_STACK_MT = "mt-8 sm:mt-10";

/** Feature split / stacked inner spacing. */
export const LANDING_FEATURE_GAP = "gap-8 sm:gap-10 lg:gap-12";

export const LANDING_FEATURE_HEADLINE_CLASS =
  "font-heading text-2xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-3xl md:text-4xl lg:text-[2.35rem] xl:text-[2.65rem]";

export const LANDING_FEATURE_BODY_CLASS =
  "mt-3 text-sm leading-relaxed text-ink-2 sm:mt-4 sm:text-base md:mt-5 md:text-lg md:leading-8";
