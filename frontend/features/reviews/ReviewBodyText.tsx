"use client";

import { useState } from "react";

type ReviewBodyTextProps = {
  body: string;
  previewLen?: number;
  expandLabels?: { more: string; less: string };
  className?: string;
};

export function ReviewBodyText({
  body,
  previewLen = 280,
  expandLabels = { more: "Read more", less: "Show less" },
  className = "text-sm leading-relaxed text-neutral-800",
}: ReviewBodyTextProps) {
  const [expanded, setExpanded] = useState(false);
  const long = body.length > previewLen;
  const shown = expanded || !long ? body : `${body.slice(0, previewLen).trim()}…`;

  if (!body) {
    return <p className={`whitespace-pre-wrap ${className}`}>—</p>;
  }

  return (
    <>
      <p className={`whitespace-pre-wrap ${className}`}>{shown}</p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? expandLabels.less : expandLabels.more}
        </button>
      ) : null}
    </>
  );
}
