import { FOCUS_RING } from "@/components/ui/tokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "inverted"
  | "outline"
  | "invertedOutline";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "default" | "pill";

/** Canvas modifier per variant (`ez-btn--*` in eventtz.css). `outline` is an alias of `secondary`. */
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "ez-btn--primary",
  secondary: "ez-btn--secondary",
  ghost: "ez-btn--ghost",
  // Soft danger: the quiet canvas button on the danger tint.
  destructive: "ez-btn--danger-quiet bg-danger-soft",
  inverted: "ez-btn--inverse",
  outline: "ez-btn--secondary",
  invertedOutline: "ez-btn--inverse-outline",
};

/** `md` is the base `ez-btn` size, so it adds no modifier. */
export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "ez-btn--sm",
  md: "",
  lg: "ez-btn--lg",
};

const BUTTON_SHAPE_CLASSES: Record<ButtonShape, string> = {
  default: "",
  pill: "ez-btn--pill",
};

export const BUTTON_MOTION_PRESS = "active:scale-[0.97]";

/** Class string for a button or a link that looks like one: `ez-btn` plus canvas modifiers. */
export function getButtonClassName({
  variant = "primary",
  size = "md",
  shape = "default",
  block = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Full-width button (`ez-btn--block`). */
  block?: boolean;
  className?: string;
} = {}): string {
  return [
    "ez-btn",
    BUTTON_VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
    BUTTON_SHAPE_CLASSES[shape],
    BUTTON_MOTION_PRESS,
    FOCUS_RING,
    block ? "ez-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
