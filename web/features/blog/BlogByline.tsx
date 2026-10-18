type BlogBylineProps = {
  authorName?: string | null;
  publishedAt?: string | null;
  /** ISO datetime for the `<time>` element */
  publishedAtIso?: string | null;
  className?: string;
};

/** Date + optional “By Author” line for blog cards and post headers. */
export function BlogByline({
  authorName,
  publishedAt,
  publishedAtIso,
  className = "",
}: BlogBylineProps) {
  const author = authorName?.trim() || null;
  if (!publishedAt && !author) return null;

  return (
    <p
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-2 ${className}`.trim()}
    >
      {publishedAt ? (
        <time
          dateTime={publishedAtIso ?? undefined}
          className="text-xs font-medium uppercase tracking-wider text-ink-3"
        >
          {publishedAt}
        </time>
      ) : null}
      {publishedAt && author ? (
        <span className="text-line-strong" aria-hidden>
          ·
        </span>
      ) : null}
      {author ? (
        <span className="text-sm font-medium text-ink">
          By {author}
        </span>
      ) : null}
    </p>
  );
}
