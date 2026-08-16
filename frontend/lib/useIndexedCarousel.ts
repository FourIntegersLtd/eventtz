"use client";

import { useCallback, useEffect, useState } from "react";

type UseIndexedCarouselOptions = {
  count: number;
  /** When this changes, index resets to 0. */
  resetKey?: string;
  autoplayMs?: number;
  autoplayEnabled?: boolean;
};

export function useIndexedCarousel({
  count,
  resetKey,
  autoplayMs,
  autoplayEnabled = true,
}: UseIndexedCarouselOptions) {
  const [index, setIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    setIndex(0);
    setProgressKey((key) => key + 1);
  }, [resetKey]);

  const goTo = useCallback(
    (next: number) => {
      if (count <= 0) return;
      const normalized = ((next % count) + count) % count;
      setIndex(normalized);
      setProgressKey((key) => key + 1);
    },
    [count],
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!autoplayMs || !autoplayEnabled || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
      setProgressKey((key) => key + 1);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayEnabled, autoplayMs, count]);

  return { index, goTo, goNext, goPrev, progressKey, setIndex };
}
