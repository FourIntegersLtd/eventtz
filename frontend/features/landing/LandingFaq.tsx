"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_SECTION, FAQ_SECTIONS, WAITLIST_LINK_LABEL, WAITLIST_URL } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SECTION_CONTENT_MT,
  LANDING_SECTION_STACK_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";

type FaqTab = "client" | "vendor";

export function LandingFaq() {
  const [tab, setTab] = useState<FaqTab>("client");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const section = FAQ_SECTIONS.find((s) => s.id === tab) ?? FAQ_SECTIONS[0];

  return (
    <LandingSection
      id="faq"
      className={landingSectionClass("white")}
      width="3xl"
    >
      <LandingSectionHeading eyebrow={FAQ_SECTION.eyebrow} title={FAQ_SECTION.title} />

      <div className={`mx-auto flex w-full max-w-xs rounded-full border border-primary-border bg-primary-soft p-1 sm:max-w-sm ${LANDING_SECTION_CONTENT_MT}`}>
        {FAQ_SECTIONS.map(({ id, heading }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setOpenKey(null);
            }}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-primary text-white shadow-sm"
                : "text-primary/70 hover:text-primary"
            }`}
          >
            {heading}
          </button>
        ))}
      </div>

      <div className={`divide-y divide-primary-border/70 ${LANDING_SECTION_STACK_MT}`}>
        {section.items.map((item, index) => {
          const faqKey = `${tab}-${index}`;
          const isOpen = openKey === faqKey;
          return (
            <div key={faqKey}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : faqKey)}
                className={`flex w-full items-start justify-between gap-3 py-3.5 text-left text-sm font-medium transition sm:items-center sm:gap-4 sm:py-4 ${
                  isOpen ? "text-primary" : "text-neutral-800"
                }`}
              >
                <span className="min-w-0 flex-1">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition ${
                    isOpen ? "rotate-180 text-primary" : "text-neutral-400"
                  }`}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <p className="pb-4 text-sm leading-relaxed text-neutral-600 sm:pb-5 sm:text-[15px] sm:leading-7">
                  {item.a}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-neutral-600 sm:mt-12">
        {FAQ_SECTION.footnote}
        <a
          href={WAITLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          {WAITLIST_LINK_LABEL}
        </a>
      </p>
    </LandingSection>
  );
}
