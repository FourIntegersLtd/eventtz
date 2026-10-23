"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FAQ_SECTION, FAQ_SECTIONS } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/components/landing/LandingSection";
import {
  LANDING_SECTION_CONTENT_MT,
  LANDING_SECTION_STACK_MT,
  landingSectionClass,
} from "@/components/landing/landingSectionStyles";

type FaqTab = "client" | "vendor";

export function LandingFaq() {
  const [tab, setTab] = useState<FaqTab>("client");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const section = FAQ_SECTIONS.find((s) => s.id === tab) ?? FAQ_SECTIONS[0];

  return (
    <LandingSection
      id="faq"
      className={landingSectionClass("white", { shell: "content" })}
      width="3xl"
    >
      <LandingSectionHeading eyebrow={FAQ_SECTION.eyebrow} title={FAQ_SECTION.title} />

      <SegmentedControl
        aria-label="FAQ audience"
        stretch
        className={`mx-auto max-w-xs sm:max-w-sm ${LANDING_SECTION_CONTENT_MT}`}
        options={FAQ_SECTIONS.map(({ id, heading }) => ({ value: id, label: heading }))}
        value={tab}
        onChange={(id) => {
          setTab(id);
          setOpenKey(null);
        }}
      />

      <div
        role="tabpanel"
        aria-label={`${section.heading} questions`}
        className={`divide-y divide-line ${LANDING_SECTION_STACK_MT}`}
      >
        {section.items.map((item, index) => {
          const faqKey = `${tab}-${index}`;
          const isOpen = openKey === faqKey;
          return (
            <div key={faqKey}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : faqKey)}
                className={`flex min-h-11 w-full items-start justify-between gap-3 py-3.5 text-left text-sm font-medium transition sm:items-center sm:gap-4 sm:py-4 ${
                  isOpen ? "text-primary" : "text-ink"
                }`}
              >
                <span className="min-w-0 flex-1">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition ${
                    isOpen ? "rotate-180 text-primary" : "text-ink-3"
                  }`}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <p className="pb-4 text-sm leading-relaxed text-ink-2 sm:pb-5 sm:text-[15px] sm:leading-7">
                  {item.a}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}
