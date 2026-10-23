import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Small uppercase line above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Description type size: `small` (default, admin and client pages) or `body` (vendor portal pages). */
  descriptionSize?: "small" | "body";
  /** Right-aligned actions, usually Buttons. */
  actions?: ReactNode;
  className?: string;
};

/** Page title block (`ez-pagehead`): eyebrow, serif title, description and an actions slot. */
export function PageHeader({
  eyebrow,
  title,
  description,
  descriptionSize = "small",
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`ez-pagehead ${className}`.trim()}>
      <div className="ez-pagehead__text">
        {eyebrow ? <span className="ez-eyebrow">{eyebrow}</span> : null}
        <h1 className="ez-h1">{title}</h1>
        {description ? <p className={descriptionSize === "body" ? "ez-body" : "ez-small"}>{description}</p> : null}
      </div>
      {actions ? <div className="ez-pagehead__actions">{actions}</div> : null}
    </header>
  );
}
