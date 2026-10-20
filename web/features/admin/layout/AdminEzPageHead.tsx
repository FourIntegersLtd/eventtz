"use client";

import type { ReactNode } from "react";

type AdminEzPageHeadProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** In-page heading for admin console pages (design: `ez-pagehead`). */
export function AdminEzPageHead({ title, description, actions }: AdminEzPageHeadProps) {
  return (
    <div className="ez-pagehead">
      <div className="ez-pagehead__text">
        <h1 className="ez-h1">{title}</h1>
        {description ? <p className="ez-small">{description}</p> : null}
      </div>
      {actions ? <div className="ez-pagehead__actions">{actions}</div> : null}
    </div>
  );
}
