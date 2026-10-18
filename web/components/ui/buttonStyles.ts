import { FOCUS_RING, RADIUS } from "@/components/ui/tokens";

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

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:opacity-95 disabled:opacity-50",
  secondary:
    "border border-line-strong bg-white text-ink hover:bg-surface-3 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-surface-3 disabled:opacity-50",
  destructive:
    "border border-danger-line bg-danger-soft text-danger hover:bg-danger-line/60 disabled:opacity-50",
  inverted: "bg-white text-primary hover:opacity-95 disabled:opacity-50",
  outline:
    "border border-line-strong bg-white text-ink hover:bg-surface-3 disabled:opacity-50",
  invertedOutline:
    "border border-white/40 bg-transparent text-white hover:bg-white/10 disabled:opacity-50",
};

export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

const BUTTON_SHAPE_CLASSES: Record<ButtonShape, string> = {
  default: RADIUS.md,
  pill: "rounded-full",
};

export const BUTTON_MOTION_PRESS = "duration-150 ease-out active:scale-[0.97]";

export function getButtonClassName({
  variant = "primary",
  size = "md",
  shape = "default",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  className?: string;
} = {}): string {
  return [
    "inline-flex items-center justify-center gap-2 font-medium transition",
    BUTTON_MOTION_PRESS,
    FOCUS_RING,
    BUTTON_VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
    BUTTON_SHAPE_CLASSES[shape],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
