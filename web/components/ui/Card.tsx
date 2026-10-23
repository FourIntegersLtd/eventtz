import type { ElementType, ReactNode } from "react";
import { CARD_PADDING, CARD_SURFACE } from "@/components/ui/tokens";

export type CardVariant = "portal" | "portal-inset" | "admin" | "muted" | "callout" | "raised";
export type CardPadding = "none" | "md" | "lg";

type CardProps<T extends ElementType = "div"> = {
  as?: T;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children: ReactNode;
};

/** Canvas card modifiers: the plain card, flat (`muted`) and brand tint (`callout`). */
const VARIANT_CLASSES: Record<CardVariant, string> = {
  portal: CARD_SURFACE,
  "portal-inset": CARD_SURFACE,
  admin: CARD_SURFACE,
  muted: "ez-card ez-card--flat",
  callout: "ez-card ez-card--brand",
  raised: "ez-card ez-card--raised",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  md: CARD_PADDING,
  lg: "p-6 sm:p-8",
};

/**
 * Shared surface container (`ez-card`): portal, admin and inset panels share one look;
 * `muted` is the flat tint, `callout` the brand tint and `raised` the lifted card of the planner.
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

/** Top slot of a Card: title row with a hairline below (`ez-card__head`). */
export function CardHeader({ className = "", children }: CardSlotProps) {
  return <div className={`ez-card__head ${className}`.trim()}>{children}</div>;
}

/** Main slot of a Card, 20px padding (`ez-card__body`). */
export function CardBody({ className = "", children }: CardSlotProps) {
  return <div className={`ez-card__body ${className}`.trim()}>{children}</div>;
}

/** Bottom slot of a Card: action row with a hairline above (`ez-card__foot`). */
export function CardFooter({ className = "", children }: CardSlotProps) {
  return <div className={`ez-card__foot ${className}`.trim()}>{children}</div>;
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
