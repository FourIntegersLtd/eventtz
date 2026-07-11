"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_SECTIONS } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingFaq() {
  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);

  return (
    <LandingSection id="faq" className="border-t border-primary-border/50 bg-primary-soft py-16 sm:py-20 md:py-24" width="3xl">
      <LandingSectionHeading eyebrow="Support" title="FAQ" />

      <div className="mt-10 space-y-10 sm:mt-12">
        {FAQ_SECTIONS.map((section, sectionIndex) => (
          <div key={section.heading}>
            <h3 className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {section.heading}
            </h3>
            <div className="mt-4 divide-y divide-primary-border rounded-2xl border border-primary-border bg-white">
              {section.items.map((item, itemIndex) => {
                const faqKey = `${sectionIndex}-${itemIndex}`;
                const isOpen = openFaqKey === faqKey;
                return (
                  <div key={faqKey}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqKey(isOpen ? null : faqKey)}
                      className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium transition hover:bg-primary-soft sm:px-6 sm:py-5 sm:text-base ${
                        isOpen ? "text-primary" : "text-neutral-800"
                      }`}
                    >
                      {item.q}
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 transition ${isOpen ? "rotate-180 text-primary" : "text-neutral-400"}`}
                        strokeWidth={1.5}
                      />
                    </button>
                    {isOpen ? (
                      <div className="border-t border-primary-border/60 px-5 pb-4 pt-1 sm:px-6 sm:pb-5">
                        <p className="text-sm leading-relaxed text-neutral-600 sm:text-base">{item.a}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
