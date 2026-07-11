"use client";

import { useState } from "react";
import { CLIENT_STEPS, VENDOR_STEPS } from "@/features/landing/landingData";
import { LandingSectionHeading } from "@/features/landing/LandingSectionHeading";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingHowItWorks() {
  const [howItWorksTab, setHowItWorksTab] = useState<"vendor" | "client">("client");
  const steps = howItWorksTab === "vendor" ? VENDOR_STEPS : CLIENT_STEPS;

  return (
    <LandingSection id="how-it-works" className="border-t border-primary-border/50 bg-white py-16 sm:py-20 md:py-24">
      <LandingSectionHeading eyebrow="The process" title="How it works" />

      <div className="mx-auto mt-8 flex max-w-md rounded-full border border-primary-border bg-primary-soft p-1 sm:mt-10">
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

      <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6 md:mt-16">
        {steps.map((item, index) => (
          <div
            key={`${howItWorksTab}-${item.step}`}
            className={`relative ${index > 0 ? "sm:border-l sm:border-primary-border sm:pl-6" : ""}`}
          >
            <span className="font-heading text-4xl font-semibold tabular-nums text-accent-gold/50">
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
