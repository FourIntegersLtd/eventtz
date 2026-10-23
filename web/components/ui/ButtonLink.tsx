import Link from "next/link";
import type { ComponentProps } from "react";
import {
  getButtonClassName,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/buttonStyles";

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Full width (`ez-btn--block`). */
  block?: boolean;
  className?: string;
};

/**
 * Next.js Link styled as a Button - use for navigation CTAs instead of
 * hand-rolled `rounded-full bg-primary` class strings.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  shape = "default",
  block = false,
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={getButtonClassName({ variant, size, shape, block, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
