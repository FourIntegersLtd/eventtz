"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { copyToClipboard } from "@/lib/copyToClipboard";

type CopyReferralLinkButtonProps = {
  link: string;
  /** Called after a successful copy (e.g. show toast). */
  onCopied?: (link: string) => void;
  className?: string;
};

export function CopyReferralLinkButton({ link, onCopied, className }: CopyReferralLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (!ok) return;
    setCopied(true);
    onCopied?.(link);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      icon={copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      onClick={() => void handleCopy()}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
