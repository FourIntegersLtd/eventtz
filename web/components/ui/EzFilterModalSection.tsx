"use client";

import type { ReactNode } from "react";

type EzFilterModalSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Titled block inside a composite list-filter modal. */
export function EzFilterModalSection({
  title,
  description,
  children,
  className = "",
}: EzFilterModalSectionProps) {
  return (
    <section className={className}>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {description ? <p className="ez-small mt-1 text-ink-2">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
