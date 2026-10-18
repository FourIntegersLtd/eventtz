"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

/** One entry of the contents list: the heading text and the element id the entry scrolls to. */
export type ComplianceSection = {
  targetId: string;
  label: string;
};

/** Turns heading text into an id-safe slug, e.g. "3. Bookings and payments" becomes "3-bookings-and-payments". */
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pixels from the viewport top at which a section counts as "current". Anchored headings stop
 * 85px down (LANDING_SCROLL_MT_CLASS, 5.3125rem: the 69px nav plus 1rem of air), so 120px
 * leaves about 35px of slack and a clicked section is already current when it lands.
 * Change together with LANDING_SCROLL_MT_CLASS in landingSectionStyles.ts.
 */
const ACTIVE_LINE_OFFSET_PX = 120;

/**
 * Reads the h2 headings rendered inside `contentRef` and returns them as contents entries,
 * plus the id of the section currently under the top of the viewport.
 *
 * Headings inside a `<nav>` (the in-text contents of the terms) are skipped. A heading whose
 * enclosing `<section>` already has an id keeps that id, so existing in-page links still work;
 * otherwise the heading gets a slug id. Heading text is never changed. The headings are re-read
 * whenever `content` (the rendered children) changes.
 */
export function useComplianceSections(contentRef: RefObject<HTMLElement | null>, content: ReactNode) {
  const [sections, setSections] = useState<ComplianceSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const found: ComplianceSection[] = [];
    container.querySelectorAll("h2").forEach((heading, index) => {
      if (heading.closest("nav")) return;
      const label = (heading.textContent ?? "").trim();
      if (!label) return;
      const target = heading.closest("section[id]") ?? heading;
      if (!target.id) {
        let candidate = slugifyHeading(label) || `section-${index + 1}`;
        while (document.getElementById(candidate)) {
          candidate = `${candidate}-${index + 1}`;
        }
        target.id = candidate;
      }
      found.push({ targetId: target.id, label });
    });
    setSections(found);
    setActiveId(found[0]?.targetId ?? null);

    /** Marks the last section whose top has passed the active line as current. */
    const updateActive = () => {
      let current = found[0]?.targetId ?? null;
      for (const section of found) {
        const element = document.getElementById(section.targetId);
        if (element && element.getBoundingClientRect().top <= ACTIVE_LINE_OFFSET_PX) {
          current = section.targetId;
        }
      }
      setActiveId(current);
    };
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [contentRef, content]);

  return { sections, activeId };
}
