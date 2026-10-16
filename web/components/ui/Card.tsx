import type { ElementType, ReactNode } from "react";
import {
  portalCard,
  portalCardPadding,
  portalCardPaddingLg,
  portalInsetCard,
} from "@/components/portal-shell/portalTheme";
import { panelCardSurface } from "@/components/ui/sectionBlockTokens";

export type CardVariant = "portal" | "portal-inset" | "admin";
export type CardPadding = "none" | "md" | "lg";

type CardProps<T extends ElementType = "div"> = {
  as?: T;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<CardVariant, string> = {
  portal: portalCard,
  "portal-inset": portalInsetCard,
  admin: panelCardSurface,
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  md: portalCardPadding,
  lg: portalCardPaddingLg,
};

/**
 * Shared surface container - portal cards, admin cards, and nested inset panels.
 */
export function Card<T extends ElementType = "div">({
  as,
  variant = "portal",
  padding = "none",
  className = "",
  children,
}: CardProps<T>) {
  const Component = as ?? "div";
  return (
    <Component
      className={`${VARIANT_CLASSES[variant]} ${PADDING_CLASSES[padding]} ${className}`.trim()}
    >
      {children}
    </Component>
  );
}
