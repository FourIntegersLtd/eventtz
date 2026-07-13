/** Native width/height of PNGs in `public/images/landing-images/`. */
export const LANDING_SCREENSHOT_DEFAULT_WIDTH = 1920;
export const LANDING_SCREENSHOT_DEFAULT_HEIGHT = 1200;

/** Natural aspect: frame grows with the image (mobile inline shots). */
export const LANDING_SCREENSHOT_NATURAL_CLASS = "block h-auto w-full";

/** Fixed-aspect frames: fill edge-to-edge without letterboxing. */
export const LANDING_SCREENSHOT_FILL_CLASS = "h-full w-full object-cover object-top";

/**
 * Max CSS width so a screenshot stays sharp on 2× displays.
 * Export at 2× your target display width (e.g. 2560px for a 1280px-wide slot).
 */
export function landingScreenshotMaxCssWidth(
  intrinsicWidth = LANDING_SCREENSHOT_DEFAULT_WIDTH,
): number {
  return Math.round(intrinsicWidth / 2);
}

/** Split layout: image column is ~65% of the 7xl content area. */
export const LANDING_SPLIT_SCREENSHOT_SIZES = "(max-width: 1024px) 90vw, 960px";

/** Stacked layout: full width up to the 2×-safe cap. */
export function landingStackedScreenshotSizes(intrinsicWidth = LANDING_SCREENSHOT_DEFAULT_WIDTH): string {
  const maxCss = landingScreenshotMaxCssWidth(intrinsicWidth);
  return `(max-width: ${maxCss}px) 100vw, ${maxCss}px`;
}
