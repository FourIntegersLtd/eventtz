"use client";

import type { ReactNode } from "react";

type VendorEzPageHeadProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** In-page heading under the portal topbar (design: ``ez-pagehead``). */
export function VendorEzPageHead({ eyebrow, title, description, actions }: VendorEzPageHeadProps) {
  return (
    <div className="ez-pagehead">
      <div className="ez-pagehead__text">
        <span className="ez-eyebrow">{eyebrow}</span>
        <h1 className="ez-h1">{title}</h1>
        {description ? <p className="ez-body">{description}</p> : null}
      </div>
      {actions ? <div className="ez-pagehead__actions">{actions}</div> : null}
    </div>
  );
}
