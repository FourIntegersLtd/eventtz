"use client";

import { BadgeCheck, CreditCard, MapPin, Tags } from "lucide-react";

const TRUST_ITEMS = [
  { icon: BadgeCheck, label: "Approved vendors" },
  { icon: CreditCard, label: "Secure payments" },
  { icon: MapPin, label: "UK-wide" },
  { icon: Tags, label: "Curated categories" },
] as const;

export function LandingTrustStrip() {
  return (
    <section className="relative z-20 -mt-10 px-4 sm:px-6 lg:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-primary-border bg-white px-4 py-3.5 shadow-primary-soft backdrop-blur-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-sm font-semibold text-primary">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
