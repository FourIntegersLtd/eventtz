import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";

type BackLinkProps = {
  href: string;
  label: string;
  icon?: "arrow" | "chevron";
  /** Primary brand link (default) or neutral text for master-detail chrome. */
  tone?: "primary" | "muted";
  /** Hide on large screens — use with master-detail layouts that show list + detail side by side. */
  mobileOnly?: boolean;
  className?: string;
};

const toneClass: Record<NonNullable<BackLinkProps["tone"]>, string> = {
  primary: "text-primary hover:opacity-80",
  muted: "text-neutral-600 hover:text-neutral-900",
};

/**
 * Consistent back navigation — arrow/chevron + label. Prefer this over ad-hoc `←` text links.
 */
export function BackLink({
  href,
  label,
  icon = "arrow",
  tone = "primary",
  mobileOnly = false,
  className = "",
}: BackLinkProps) {
  const Icon = icon === "chevron" ? ChevronLeft : ArrowLeft;
  const visibility = mobileOnly ? "inline-flex lg:hidden" : "inline-flex";

  return (
    <Link
      href={href}
      className={`${visibility} items-center gap-1.5 text-sm font-medium transition ${toneClass[tone]} ${className}`.trim()}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
