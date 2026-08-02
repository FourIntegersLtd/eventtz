"use client";

import type { ReactNode } from "react";
import {
  contentCardPadding,
  contentCardSurface,
  panelCardSurface,
  sectionBlockBody,
  sectionHeaderDescription,
  sectionHeaderTitle,
  sectionHeaderWrap,
  sectionSubheading,
} from "@/components/ui/sectionBlockTokens";

export function SectionHeader({
  title,
  description,
  trailing,
  className = "",
  variant = "section",
}: {
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** `section` = on page/modal canvas; `panel` = inside a PanelCard shell. */
  variant?: "section" | "panel";
}) {
  const wrapClass =
    variant === "panel" ? "mb-4 border-b-2 border-neutral-200 pb-3" : sectionHeaderWrap;

  return (
    <div className={`${wrapClass} ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={sectionHeaderTitle}>{title}</h2>
          {description ? <div className={sectionHeaderDescription}>{description}</div> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

export function SectionSubheading({
  title,
  onClick,
  className = "",
}: {
  title: string;
  onClick?: () => void;
  className?: string;
}) {
  const classNames = `${sectionSubheading} ${className}`.trim();

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classNames} hover:text-primary`}>
        {title}
      </button>
    );
  }

  return <h3 className={classNames}>{title}</h3>;
}

/** Section on a gray/page canvas: prominent header, then inset content card(s). */
export function SectionBlock({
  id,
  title,
  description,
  trailing,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-4 ${className}`.trim()}>
      <SectionHeader title={title} description={description} trailing={trailing} />
      {children != null ? <div className={sectionBlockBody}>{children}</div> : null}
    </section>
  );
}

/** White inset card (modal sections, section body panels). */
export function ContentCard({
  children,
  className = "",
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: "md" | "none";
}) {
  const pad = padding === "md" ? contentCardPadding : "";
  return (
    <div className={`${contentCardSurface} ${pad} ${className}`.trim()}>{children}</div>
  );
}

/** Full panel shell (tables, charts, standalone admin cards). */
export function PanelCard({
  children,
  className = "",
  title,
  description,
  trailing,
  bodyClassName = "",
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
  trailing?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className={`${panelCardSurface} overflow-hidden ${className}`.trim()}>
      {title ? (
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <SectionHeader
            variant="panel"
            title={title}
            description={description}
            trailing={trailing}
          />
        </div>
      ) : null}
      <div className={`px-5 pb-5 sm:px-6 sm:pb-6 ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
