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

/** Page title block: eyebrow, serif title, description and an actions slot. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-4 ${className}`.trim()}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-1.5 text-sm leading-relaxed text-ink-3">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
