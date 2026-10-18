import type { ElementType, ReactNode } from "react";
import {
  portalCard,
  portalCardPadding,
  portalCardPaddingLg,
  portalInsetCard,
} from "@/components/portal-shell/portalTheme";
import { panelCardSurface } from "@/components/ui/sectionBlockTokens";

export type CardVariant = "portal" | "portal-inset" | "admin" | "muted" | "callout";
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
  muted: "rounded-2xl border border-line bg-surface-3",
  callout: "rounded-2xl border border-primary-border bg-primary-soft",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  md: portalCardPadding,
  lg: portalCardPaddingLg,
};

/**
 * Shared surface container - portal cards, admin cards, nested inset panels, and
 * `muted` (surface-3) and `callout` (brand tint) variants.
 */
function CardRoot<T extends ElementType = "div">({
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

type CardSlotProps = { className?: string; children: ReactNode };

/** Top slot of a Card: title row with a hairline below. */
export function CardHeader({ className = "", children }: CardSlotProps) {
  return <div className={`border-b border-line px-5 py-4 ${className}`.trim()}>{children}</div>;
}

/** Main slot of a Card, 20px padding. */
export function CardBody({ className = "", children }: CardSlotProps) {
  return <div className={`p-5 ${className}`.trim()}>{children}</div>;
}

/** Bottom slot of a Card: action row with a hairline above. */
export function CardFooter({ className = "", children }: CardSlotProps) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
