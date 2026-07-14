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
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-neutral-600 ${className}`.trim()}
    >
      {publishedAt ? (
        <time
          dateTime={publishedAtIso ?? undefined}
          className="text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          {publishedAt}
        </time>
      ) : null}
      {publishedAt && author ? (
        <span className="text-neutral-300" aria-hidden>
          ·
        </span>
      ) : null}
      {author ? (
        <span className="text-sm font-medium text-neutral-800">
          By {author}
        </span>
      ) : null}
    </p>
  );
}
