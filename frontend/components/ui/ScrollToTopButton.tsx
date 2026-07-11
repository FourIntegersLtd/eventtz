"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

type ScrollToTopButtonProps = {
  className?: string;
};

/** Floating control for long-scroll marketing and browse pages. */
export function ScrollToTopButton({ className = "" }: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 transition hover:opacity-95 ${className}`}
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
