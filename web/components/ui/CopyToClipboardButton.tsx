"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/copyToClipboard";

type CopyToClipboardButtonProps = {
  text: string;
  ariaLabel?: string;
  className?: string;
  onCopied?: () => void;
};

export function CopyToClipboardButton({
  text,
  ariaLabel = "Copy to clipboard",
  className = "",
  onCopied,
}: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : ariaLabel}
      title={copied ? "Copied" : ariaLabel}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`.trim()}
      onClick={(event) => void handleCopy(event)}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
