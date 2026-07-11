"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_SECTIONS, WAITLIST_LINK_LABEL, WAITLIST_URL } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

type FaqTab = "client" | "vendor";

export function LandingFaq() {
  const [tab, setTab] = useState<FaqTab>("client");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const section = FAQ_SECTIONS.find((s) => s.id === tab) ?? FAQ_SECTIONS[0];

  return (
    <LandingSection
      id="faq"
      className="border-t border-primary-border/50 bg-white py-16 sm:py-20 md:py-24"
      width="3xl"
    >
      <LandingSectionHeading eyebrow="FAQ" title="Common questions" />

      <div className="mx-auto mt-8 flex max-w-xs rounded-full border border-primary-border bg-primary-soft p-1 sm:mt-10">
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

      <div className="mt-8 divide-y divide-primary-border/70 sm:mt-10">
        {section.items.map((item, index) => {
          const faqKey = `${tab}-${index}`;
          const isOpen = openKey === faqKey;
          return (
            <div key={faqKey}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : faqKey)}
                className={`flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium transition sm:py-5 ${
                  isOpen ? "text-primary" : "text-neutral-800"
                }`}
              >
                {item.q}
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
        New categories coming soon.{" "}
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
