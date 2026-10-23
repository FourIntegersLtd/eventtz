"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LANDING_NAV_STICKY_ASIDE_TOP_CLASS, LANDING_SCROLL_MT_DESCENDANTS_CLASS } from "@/components/landing/landingSectionStyles";
import { useComplianceSections, type ComplianceSection } from "@/components/compliances/useComplianceSections";

type ComplianceReaderProps = {
  children: ReactNode;
};

type ContentsListProps = {
  sections: ComplianceSection[];
  activeId: string | null;
};

/** Scrolls smoothly to a section and records it in the URL hash without adding history entries. */
function scrollToSection(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${targetId}`);
}

/** The list of section links; the current section is highlighted and marked with aria-current. */
function ContentsList({ sections, activeId }: ContentsListProps) {
  return (
    <ul className="space-y-0.5">
      {sections.map((section) => {
        const active = section.targetId === activeId;
        return (
          <li key={section.targetId}>
            <a
              href={`#${section.targetId}`}
              aria-current={active ? "location" : undefined}
              onClick={(event) => scrollToSection(event, section.targetId)}
              className={`flex min-h-[2.375rem] items-center rounded-lg px-3 py-1.5 text-sm font-medium leading-snug transition ${
                active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-3 hover:text-ink"
              }`}
            >
              {section.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Two-column legal reader: a contents list built from the page's own h2 headings on the left
 * (sticky on desktop, a disclosure above the text on mobile) and the policy text on the right.
 */
export function ComplianceReader({ children }: ComplianceReaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { sections, activeId } = useComplianceSections(contentRef, children);

  return (
    <div className="lg:grid lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      {sections.length > 0 ? (
        <>
          <details className="group mb-6 rounded-xl border border-line bg-white shadow-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
              Contents
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <nav aria-label="Contents" className="border-t border-line p-2">
              <ContentsList sections={sections} activeId={activeId} />
            </nav>
          </details>
          <aside
            className={`hidden lg:sticky ${LANDING_NAV_STICKY_ASIDE_TOP_CLASS} lg:block`}
          >
            <Card padding="none" className="shadow-card">
              <nav aria-label="Contents" className="max-h-[calc(100dvh-8.5rem)] overflow-y-auto p-3">
                <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Contents
                </p>
                <ContentsList sections={sections} activeId={activeId} />
              </nav>
            </Card>
          </aside>
        </>
      ) : null}
      <Card padding="lg" className="min-w-0 shadow-card lg:col-start-2">
        <div ref={contentRef} className={`compliance-prose max-w-[47.5rem] ${LANDING_SCROLL_MT_DESCENDANTS_CLASS}`}>
          {children}
        </div>
      </Card>
    </div>
  );
}
