import type { ElementType, ReactNode } from "react";
import { adminCard } from "@/features/admin/adminTheme";
import {
  portalCard,
  portalCardPadding,
  portalCardPaddingLg,
  portalInsetCard,
} from "@/components/portal-shell/portalTheme";

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
  admin: adminCard,
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  md: portalCardPadding,
  lg: portalCardPaddingLg,
};

/**
 * Shared surface container — portal cards, admin cards, and nested inset panels.
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
