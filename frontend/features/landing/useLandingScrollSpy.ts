"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks which tall scroll panel is most visible in the viewport.
 * Used for sticky image swaps on the landing journey section.
 */
export function useLandingScrollSpy(stepCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  const setStepRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      stepRefs.current[index] = el;
    };
  }, []);

  useLayoutEffect(() => {
    if (stepCount <= 0) return;

    const ratios = new Array<number>(stepCount).fill(0);

    const pickActive = () => {
      let bestIndex = 0;
      let bestRatio = ratios[0] ?? 0;
      for (let i = 1; i < stepCount; i += 1) {
        const ratio = ratios[i] ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIndex = i;
        }
      }
      if (bestRatio > 0) {
        setActiveIndex((prev) => (prev === bestIndex ? prev : bestIndex));
      }
    };

    const observers: IntersectionObserver[] = [];

    for (let index = 0; index < stepCount; index += 1) {
      const el = stepRefs.current[index];
      if (!el) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.target === el) {
              ratios[index] = entry.intersectionRatio;
            }
          }
          pickActive();
        },
        {
          root: null,
          threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
          rootMargin: "-18% 0px -32% 0px",
        },
      );
      observer.observe(el);
      observers.push(observer);
    }

    pickActive();

    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [stepCount]);

  const scrollToStep = useCallback((index: number) => {
    stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return { activeIndex, setStepRef, scrollToStep };
}
