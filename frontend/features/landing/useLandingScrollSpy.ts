"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

type StepSlot = {
  mobile: HTMLElement | null;
  desktop: HTMLElement | null;
};

/**
 * Tracks which scroll panel is most visible in the viewport.
 * Mobile uses the horizontal carousel root; desktop uses the copy column only.
 */
export function useLandingScrollSpy(
  stepCount: number,
  carouselRef: RefObject<HTMLDivElement | null>,
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepSlots = useRef<StepSlot[]>([]);

  const ensureSlot = (index: number): StepSlot => {
    if (!stepSlots.current[index]) {
      stepSlots.current[index] = { mobile: null, desktop: null };
    }
    return stepSlots.current[index]!;
  };

  const setMobileStepRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      ensureSlot(index).mobile = el;
    };
  }, []);

  const setDesktopStepRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      ensureSlot(index).desktop = el;
    };
  }, []);

  useLayoutEffect(() => {
    if (stepCount <= 0) return;

    const ratios = new Array<number>(stepCount).fill(0);
    const observers: IntersectionObserver[] = [];

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

    const disconnectObservers = () => {
      for (const observer of observers) observer.disconnect();
      observers.length = 0;
      ratios.fill(0);
    };

    const connectObservers = () => {
      disconnectObservers();

      const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
      const carousel = carouselRef.current;

      for (let index = 0; index < stepCount; index += 1) {
        const slot = stepSlots.current[index];
        if (!slot) continue;

        if (!isDesktop && slot.mobile && carousel) {
          const mobileEl = slot.mobile;
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.target === mobileEl) {
                  ratios[index] = entry.intersectionRatio;
                }
              }
              pickActive();
            },
            {
              root: carousel,
              threshold: [0, 0.35, 0.55, 0.75, 1],
            },
          );
          observer.observe(mobileEl);
          observers.push(observer);
          continue;
        }

        if (isDesktop && slot.desktop) {
          const desktopEl = slot.desktop;
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.target === desktopEl) {
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
          observer.observe(desktopEl);
          observers.push(observer);
        }
      }

      pickActive();
    };

    connectObservers();

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onBreakpointChange = () => {
      connectObservers();
    };
    mediaQuery.addEventListener("change", onBreakpointChange);

    return () => {
      mediaQuery.removeEventListener("change", onBreakpointChange);
      disconnectObservers();
    };
  }, [stepCount, carouselRef]);

  const scrollToStep = useCallback(
    (index: number) => {
      const slot = stepSlots.current[index];
      if (!slot) return;

      const carousel = carouselRef.current;
      const mobileCard = slot.mobile;
      if (carousel && mobileCard && window.matchMedia("(max-width: 1023px)").matches) {
        const carouselRect = carousel.getBoundingClientRect();
        const cardRect = mobileCard.getBoundingClientRect();
        const targetLeft =
          carousel.scrollLeft +
          (cardRect.left - carouselRect.left) -
          (carousel.clientWidth - cardRect.width) / 2;
        carousel.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: "smooth",
        });
        return;
      }

      const desktopEl = slot.desktop;
      if (!desktopEl) return;
      desktopEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    },
    [carouselRef],
  );

  return { activeIndex, setMobileStepRef, setDesktopStepRef, scrollToStep };
}
