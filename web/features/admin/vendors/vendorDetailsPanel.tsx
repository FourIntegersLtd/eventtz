"use client";

import type { ReactNode } from "react";

/** Admin vendor review cards, using the design-system card instead of the shared portal card. */

export function VendorPanelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ez-card ${className}`.trim()}>
      <div className="ez-card__body">{children}</div>
    </div>
  );
}

/** Wizard-style section card (vendor review submission fields). */
export function VendorWizardSectionCard({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`ez-card overflow-hidden ${className}`.trim()}>
      <div className="ez-card__head">
        <div>
          <h2 className="ez-h3">{title}</h2>
          {description ? <p className="ez-small">{description}</p> : null}
        </div>
      </div>
      <div className="ez-card__body flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function VendorPanelSection({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <VendorWizardSectionCard id={id} title={title} description={description} className={className}>
      {children}
    </VendorWizardSectionCard>
  );
}

export function VendorPanelSectionHeader({
  title,
  description,
  trailing,
}: {
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="ez-section-title">
      <div>
        <h2 className="ez-h3">{title}</h2>
        {description ? <p className="ez-small">{description}</p> : null}
      </div>
      {trailing}
    </div>
  );
}

export function VendorPanelCardHeading({
  title,
  onClick,
  className = "",
}: {
  title: string;
  onClick?: () => void;
  className?: string;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`ez-h3 mb-3 text-left ${className}`.trim()}>
        {title}
      </button>
    );
  }
  return <h3 className={`ez-h3 mb-3 ${className}`.trim()}>{title}</h3>;
}
