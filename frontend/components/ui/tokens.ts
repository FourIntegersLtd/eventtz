/**
 * Shared design tokens for `components/ui/*`. This is the single place the
 * "Apple-level craft bar" from the UX overhaul plan is encoded as values —
 * every primitive imports from here instead of re-declaring its own
 * spacing/motion/shadow/radius choices.
 *
 * Spacing itself intentionally has no token here: Tailwind's default scale
 * is already a 4px grid, so primitives should just use standard Tailwind
 * spacing utilities (p-2, gap-3, ...) rather than arbitrary values.
 */

/** Motion: one easing curve, two durations. Nothing in the app should need a third. */
export const MOTION = {
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  durationMicroMs: 150,
  durationStandardMs: 220,
  /** Tailwind-friendly class fragments for the common cases. */
  classNames: {
    micro: "duration-150 ease-out",
    standard: "duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
  },
} as const;

/** Elevation: resting (cards), raised (hover/popover), overlay (drawer/modal). */
export const SHADOW = {
  resting: "shadow-sm",
  raised: "shadow-md",
  overlay: "shadow-xl",
} as const;

/** Corner radius: sm (chips/inputs), md (cards/buttons), lg (panels/modals/drawers). */
export const RADIUS = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
} as const;

/** One focus ring, reused by every interactive primitive instead of the browser default. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** Mobile: 44px minimum touch target (Apple HIG / WCAG 2.5.5). */
export const TOUCH_TARGET = "min-h-11 min-w-11";

/** Full-page shells — dvh accounts for mobile browser chrome. */
export const VIEWPORT_MIN = "min-h-dvh";

/** Modal panel base width — max width comes from Modal's `maxWidthClassName`. */
export const MODAL_PANEL = "w-full";
