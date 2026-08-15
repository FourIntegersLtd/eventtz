"use client";

import { RotatingTypewriterPlaceholder } from "@/components/ui/RotatingTypewriterPlaceholder";

export const MARKETPLACE_SEARCH_PLACEHOLDER_EXAMPLES = [
  "puff-puff vendor in Leeds",
  "Help me plan my 30th birthday",
  "small chops caterer in Manchester",
  "wedding cake baker in London",
  "photographer for a naming ceremony",
  "Help me select vendors for my wedding",
] as const;

type RotatingSearchPlaceholderProps = {
  visible: boolean;
  /** Slightly smaller text on the browse (non-landing) search bar. */
  compact?: boolean;
};

export function RotatingSearchPlaceholder({
  visible,
  compact = false,
}: RotatingSearchPlaceholderProps) {
  return (
    <RotatingTypewriterPlaceholder
      examples={MARKETPLACE_SEARCH_PLACEHOLDER_EXAMPLES}
      visible={visible}
      compact={compact}
      className={compact ? "pl-10 pr-4" : "pl-11 pr-4"}
    />
  );
}
