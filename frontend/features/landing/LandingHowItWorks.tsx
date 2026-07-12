"use client";

import { useState } from "react";
import { CLIENT_STEPS, HOW_IT_WORKS_SECTION, VENDOR_STEPS } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";
import {
  LANDING_SECTION_CONTENT_MT,
  LANDING_SECTION_STACK_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";

export function LandingHowItWorks() {
  const [howItWorksTab, setHowItWorksTab] = useState<"vendor" | "client">("client");
  const steps = howItWorksTab === "vendor" ? VENDOR_STEPS : CLIENT_STEPS;

  return (
    <LandingSection id="how-it-works" className={landingSectionClass("muted")}>
      <LandingSectionHeading
        eyebrow={HOW_IT_WORKS_SECTION.eyebrow}
        title={HOW_IT_WORKS_SECTION.title}
      />

      <div className={`mx-auto flex max-w-md rounded-full border border-primary-border bg-primary-soft p-1 ${LANDING_SECTION_CONTENT_MT}`}>
        <button
          type="button"
          onClick={() => setHowItWorksTab("client")}
          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition ${
            howItWorksTab === "client"
              ? "bg-primary text-white shadow-sm"
              : "text-primary/70 hover:text-primary"
          }`}
        >
          For clients
        </button>
        <button
          type="button"
          onClick={() => setHowItWorksTab("vendor")}
          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition ${
            howItWorksTab === "vendor"
              ? "bg-primary text-white shadow-sm"
              : "text-primary/70 hover:text-primary"
          }`}
        >
          For vendors
        </button>
      </div>

      <div
        className={`${LANDING_SECTION_STACK_MT} grid gap-8 sm:grid-cols-2 sm:gap-6 ${
          steps.length >= 4 ? "lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        {steps.map((item, index) => (
          <div
            key={`${howItWorksTab}-${item.step}`}
            className={`relative ${
              steps.length === 3 && index > 0
                ? "sm:border-l sm:border-primary-border sm:pl-6"
                : ""
            }`}
          >
            <span className="font-heading text-3xl font-semibold tabular-nums text-accent-gold/50 sm:text-4xl">
              {String(item.step).padStart(2, "0")}
            </span>
            <h3 className="font-heading mt-3 text-lg font-semibold text-primary">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.description}</p>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
