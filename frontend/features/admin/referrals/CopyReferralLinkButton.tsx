"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/copyToClipboard";

type CopyReferralLinkButtonProps = {
  link: string;
  /** Called after a successful copy (e.g. show toast). */
  onCopied?: (link: string) => void;
  className?: string;
};

export function CopyReferralLinkButton({ link, onCopied, className = "" }: CopyReferralLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (!ok) return;
    setCopied(true);
    onCopied?.(link);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Copy link"}
      title={copied ? "Copied" : "Copy link"}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`.trim()}
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
