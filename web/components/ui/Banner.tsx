import type { ReactNode } from "react";
import { RADIUS, TONE } from "@/components/ui/tokens";
import type { Tone } from "@/lib/tone";

export type BannerProps = {
  tone?: Tone;
  /** Optional leading icon, e.g. a lucide icon at h-5 w-5. */
  icon?: ReactNode;
  title?: string;
  /** Optional call to action, usually a Button size="sm". */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Inline notice box that replaces hand-rolled amber and red alert boxes. */
export function Banner({
  tone = "info",
  icon,
  title,
  action,
  className = "",
  children,
}: BannerProps) {
  const toneClasses = TONE[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex flex-wrap items-start gap-3 ${RADIUS.lg} border p-4 ${toneClasses.background} ${toneClasses.line} ${className}`.trim()}
    >
      {icon ? <span className={`mt-0.5 shrink-0 ${toneClasses.text}`}>{icon}</span> : null}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className={`text-sm font-medium ${toneClasses.text}`}>{title}</p> : null}
        {children ? <div className="text-sm leading-relaxed text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
