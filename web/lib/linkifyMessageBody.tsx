import type { ReactNode } from "react";

const URL_PATTERN = /https?:\/\/[^\s]+/g;

/** Split plain text into segments, keeping URLs as separate tokens. */
function segmentsWithUrls(text: string): Array<{ kind: "text" | "url"; value: string }> {
  const parts: Array<{ kind: "text" | "url"; value: string }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({ kind: "url", value: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

type Props = {
  body: string;
  className?: string;
  /** Override link styling (e.g. light links on dark message bubbles). */
  linkClassName?: string;
};

const DEFAULT_LINK_CLASS =
  "font-medium text-primary underline underline-offset-2 hover:text-primary/80";

/** Renders chat/support message text with clickable http(s) links. */
export function LinkifyMessageBody({
  body,
  className = "",
  linkClassName = DEFAULT_LINK_CLASS,
}: Props) {
  const segments = segmentsWithUrls(body);
  const nodes: ReactNode[] = segments.map((segment, index) => {
    if (segment.kind === "url") {
      return (
        <a
          key={`url-${index}`}
          href={segment.value}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {segment.value}
        </a>
      );
    }
    return <span key={`text-${index}`}>{segment.value}</span>;
  });

  return <p className={className}>{nodes}</p>;
}
