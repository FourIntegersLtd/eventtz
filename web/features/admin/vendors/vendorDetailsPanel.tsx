"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** Admin vendor review cards, using the design-system card instead of the shared portal card. */

export function VendorPanelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <Card.Body>{children}</Card.Body>
    </Card>
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
    <Card as="section" id={id} className={`overflow-hidden ${className}`.trim()}>
      <Card.Header>
        <div>
          <h2 className="ez-h3">{title}</h2>
          {description ? <p className="ez-small">{description}</p> : null}
        </div>
      </Card.Header>
      <Card.Body className="flex min-w-0 flex-col gap-4">{children}</Card.Body>
    </Card>
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
