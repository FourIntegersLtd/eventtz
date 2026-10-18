import type { Tone } from "@/lib/tone";

/**
 * Shared design tokens for `components/ui/*`. This is the single place the
 * "Apple-level craft bar" from the UX overhaul plan is encoded as values -
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

/** Elevation: resting (cards), raised (hover/popover), overlay (drawer/modal). Values live in globals.css. */
export const SHADOW = {
  resting: "shadow-xs",
  raised: "shadow-card",
  overlay: "shadow-overlay",
} as const;

/** Corner radius: sm/md (controls, buttons: 10px), lg (cards, modals, drawers: 16px). Pills use rounded-full. */
export const RADIUS = {
  sm: "rounded-control",
  md: "rounded-control",
  lg: "rounded-card",
} as const;

/** Modal and drawer backdrop. */
export const SCRIM = "bg-scrim";

/** Semantic tone classes shared by Badge, Banner, StatTile deltas and anything else that signals meaning. */
export const TONE: Record<Tone, { text: string; background: string; line: string }> = {
  neutral: { text: "text-ink-2", background: "bg-surface-3", line: "border-line" },
  brand: { text: "text-primary", background: "bg-primary-soft", line: "border-primary-border" },
  success: { text: "text-success", background: "bg-success-soft", line: "border-success-line" },
  warning: { text: "text-warning", background: "bg-warning-soft", line: "border-warning-line" },
  danger: { text: "text-danger", background: "bg-danger-soft", line: "border-danger-line" },
  info: { text: "text-info", background: "bg-info-soft", line: "border-info-line" },
};

/** One focus ring, reused by every interactive primitive instead of the browser default. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** Mobile: 44px minimum touch target (Apple HIG / WCAG 2.5.5). */
export const TOUCH_TARGET = "min-h-11 min-w-11";

/** Full-page shells - dvh accounts for mobile browser chrome. */
export const VIEWPORT_MIN = "min-h-dvh";

/** Modal panel base width - max width comes from Modal's `maxWidthClassName`. */
export const MODAL_PANEL = "w-full";

/** Shared single-line / multi-line form control sizing (mobile-first 16px, 44px min height). */
export const FORM_CONTROL =
  "box-border w-full min-w-0 max-w-full min-h-11 rounded-control border border-line-strong bg-white px-3 py-2.5 text-base font-normal text-ink outline-none transition placeholder:text-ink-3 md:text-sm";

export const FORM_CONTROL_FOCUS = "focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Compose base + focus (+ optional extra) for raw inputs outside `components/ui/*`. */
export function formControlClass(extra = ""): string {
  return `${FORM_CONTROL} ${FORM_CONTROL_FOCUS} ${extra}`.trim();
}
