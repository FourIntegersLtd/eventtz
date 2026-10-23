import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Small uppercase line above the title. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Right-aligned actions, usually Buttons. */
  actions?: ReactNode;
  className?: string;
};

/** Page title block (`ez-pagehead`): eyebrow, serif title, description and an actions slot. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`ez-pagehead ${className}`.trim()}>
      <div className="ez-pagehead__text">
        {eyebrow ? <span className="ez-eyebrow">{eyebrow}</span> : null}
        <h1 className="ez-h1">{title}</h1>
        {description ? <div className="ez-small">{description}</div> : null}
      </div>
      {actions ? <div className="ez-pagehead__actions">{actions}</div> : null}
    </header>
  );
}
