import type { ReactNode } from "react";
import type { Tone } from "@/lib/tone";

export type BannerProps = {
  tone?: Tone;
  /** Optional leading icon, e.g. a lucide icon (the canvas sizes it to 20px). */
  icon?: ReactNode;
  title?: string;
  /** Optional call to action, usually a Button size="sm". */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Inline notice box (`ez-banner--<tone>`) that replaces hand-rolled amber and red alert boxes. */
export function Banner({
  tone = "info",
  icon,
  title,
  action,
  className = "",
  children,
}: BannerProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`ez-banner ez-banner--${tone} ${className}`.trim()}
    >
      {icon}
      <div className="ez-banner__body">
        {title ? <span className="ez-banner__title">{title}</span> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className="ez-banner__actions">{action}</div> : null}
    </div>
  );
}
