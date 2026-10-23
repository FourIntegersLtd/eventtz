"use client";

import type { ReactNode } from "react";

type ClientEzPageHeadProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** In-page heading under the portal topbar (design: `ez-pagehead`). */
export function ClientEzPageHead({ eyebrow, title, description, actions }: ClientEzPageHeadProps) {
  return (
    <div className="ez-pagehead">
      <div className="ez-pagehead__text">
        {eyebrow ? <span className="ez-eyebrow">{eyebrow}</span> : null}
        <h1 className="ez-h1">{title}</h1>
        {description ? <p className="ez-small">{description}</p> : null}
      </div>
      {actions ? <div className="ez-pagehead__actions">{actions}</div> : null}
    </div>
  );
}
